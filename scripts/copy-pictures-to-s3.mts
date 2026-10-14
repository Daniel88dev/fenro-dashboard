// Copies pictures on tasks from UploadThing into S3 under the same keys.
// scripts/copy-pictures-to-s3.sh is the entry point; it resolves the
// settings and hands them over in the environment.
//
// PICTURES_S3_ENDPOINT, PICTURES_S3_ACCESS_KEY_ID and
// PICTURES_S3_SECRET_ACCESS_KEY are read too, so a laptop can rehearse the
// copy against the S3 stand-in in compose.yaml.
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { Pool } from "pg";
import { UTApi } from "uploadthing/server";

const env = process.env;
const dryRun = process.argv.includes("--dry-run");

for (const name of [
  "DATABASE_URL",
  "UPLOADTHING_TOKEN",
  "PICTURES_S3_BUCKET",
]) {
  if (!env[name]) {
    console.error(`${name} is required`);
    process.exit(2);
  }
}
const bucket = env.PICTURES_S3_BUCKET!;

const s3 = new S3Client({
  region: env.PICTURES_S3_REGION ?? "eu-central-1",
  ...(env.PICTURES_S3_ENDPOINT
    ? { endpoint: env.PICTURES_S3_ENDPOINT, forcePathStyle: true }
    : {}),
  ...(env.PICTURES_S3_ACCESS_KEY_ID && env.PICTURES_S3_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: env.PICTURES_S3_ACCESS_KEY_ID,
          secretAccessKey: env.PICTURES_S3_SECRET_ACCESS_KEY,
        },
      }
    : {}),
});
const uploadThing = new UTApi({
  token: env.UPLOADTHING_TOKEN,
  logLevel: "Error",
});
const pool = new Pool({ connectionString: env.DATABASE_URL });

type Row = { id: string; storage_key: string; type: string; byte_size: number };

/** The object's size in the bucket, or undefined when it is not there. */
async function sizeInBucket(key: string): Promise<number | undefined> {
  try {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    return head.ContentLength;
  } catch (error) {
    if (
      error instanceof S3ServiceException &&
      error.$metadata.httpStatusCode === 404
    ) {
      return undefined;
    }
    throw error;
  }
}

async function copy(row: Row): Promise<void> {
  const { ufsUrl } = await uploadThing.generateSignedURL(row.storage_key, {
    expiresIn: "10m",
  });
  const response = await fetch(ufsUrl);
  if (!response.ok) throw new Error(`UploadThing answered ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== row.byte_size) {
    throw new Error(
      `got ${bytes.byteLength} bytes, the database says ${row.byte_size}`,
    );
  }
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: row.storage_key,
      Body: bytes,
      ContentType: row.type,
      ContentLength: bytes.byteLength,
    }),
  );
}

let copied = 0;
let skipped = 0;
const failed: string[] = [];

try {
  const { rows } = await pool.query<Row>(
    "select id, storage_key, type, byte_size from fenro.task_picture order by added_at",
  );
  console.log(
    `${rows.length} pictures in the database, bucket ${bucket}${dryRun ? " (dry run)" : ""}`,
  );

  for (const row of rows) {
    try {
      if ((await sizeInBucket(row.storage_key)) === row.byte_size) {
        skipped += 1;
        continue;
      }
      if (dryRun) {
        console.log(`would copy ${row.id}`);
      } else {
        await copy(row);
        console.log(`copied ${row.id}`);
      }
      copied += 1;
    } catch (error) {
      failed.push(row.id);
      console.error(`FAILED ${row.id}: ${(error as Error).message}`);
    }
  }
} finally {
  await pool.end();
}

console.log(
  `${dryRun ? "to copy" : "copied"}: ${copied}, already in the bucket: ${skipped}, failed: ${failed.length}`,
);
if (failed.length > 0) {
  console.error(
    "Run the script again; failed pictures are retried and copied ones skipped.",
  );
  process.exit(1);
}
