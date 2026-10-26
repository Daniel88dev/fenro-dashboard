import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// `npx skills` skips a SKILL.md with broken frontmatter with only a warning,
// so a typo here would silently drop the skill from installs.

const root = join(process.cwd(), "skills");
const folders = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

function frontmatter(source: string): Record<string, string> {
  const block = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!block) return {};
  const fields: Record<string, string> = {};
  for (const [, key, value] of block[1]!.matchAll(/^([a-z-]+):\s*(.*)$/gm)) {
    fields[key!] = value!.trim();
  }
  return fields;
}

describe("installable skills", () => {
  it("ships the Fenro skills", () => {
    expect(folders).toEqual(
      expect.arrayContaining(["fenro-setup", "fenro-task"]),
    );
  });

  describe.each(folders)("%s", (folder) => {
    const source = readFileSync(join(root, folder, "SKILL.md"), "utf8");
    const fields = frontmatter(source);

    it("is named after its folder, as the Agent Skills format requires", () => {
      expect(fields.name).toBe(folder);
      expect(folder).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(folder.length).toBeLessThanOrEqual(64);
    });

    it("has a description within the length limit", () => {
      expect(fields.description?.length ?? 0).toBeGreaterThan(0);
      expect(fields.description!.length).toBeLessThanOrEqual(1024);
    });

    it("links only to files it ships", () => {
      for (const [, target] of source.matchAll(/\]\(([^)#:]+\.md)\)/g)) {
        expect(existsSync(join(root, folder, target!)), target).toBe(true);
      }
    });
  });
});
