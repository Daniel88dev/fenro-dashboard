# Only www is attached. A sign-in started on the bare domain would set its
# cookies where the www callback never sees them, so the apex must not serve
# the app.
#
# TWO-STEP ROLLOUT of the validation records, as in flexi-day-be: they are
# unknown until the association exists, and for_each cannot iterate over
# unknown values.
#   1. terraform apply with create_service = true   (association is created)
#   2. set manage_dns_validation_records = true
#   3. terraform apply                               (validation records)
# Every apply after that is a normal one.

locals {
  app_host = "www.${var.domain_name}"
  app_url  = "https://${local.app_host}"
}

resource "aws_apprunner_custom_domain_association" "app" {
  count = var.create_service ? 1 : 0

  domain_name          = local.app_host
  service_arn          = aws_apprunner_service.app[0].arn
  enable_www_subdomain = false
}

# Keep these: App Runner also uses them to renew the certificate.
resource "aws_route53_record" "cert_validation" {
  for_each = var.create_service && var.manage_dns_validation_records ? {
    for record in aws_apprunner_custom_domain_association.app[0].certificate_validation_records :
    record.name => record
  } : {}

  zone_id = data.aws_route53_zone.main.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 300
  records = [each.value.value]
}

resource "aws_route53_record" "www" {
  count = var.create_service ? 1 : 0

  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.app_host
  type    = "CNAME"
  ttl     = 300
  records = [aws_apprunner_custom_domain_association.app[0].dns_target]
}
