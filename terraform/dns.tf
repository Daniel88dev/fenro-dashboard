# The app is served on www. A sign-in started on the bare domain would set its
# cookies where the www callback never sees them, so the bare domain, once
# redirect_bare_domain is on, reaches the service only to be redirected to www
# by the app itself (src/proxy.ts).
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

# The bare domain is a second association on the same service, with its own
# certificate and the same two-step rollout:
#   1. terraform apply with redirect_bare_domain = true
#   2. set manage_bare_domain_validation_records = true
#   3. terraform apply
resource "aws_apprunner_custom_domain_association" "bare" {
  count = var.create_service && var.redirect_bare_domain ? 1 : 0

  domain_name          = var.domain_name
  service_arn          = aws_apprunner_service.app[0].arn
  enable_www_subdomain = false
}

resource "aws_route53_record" "bare_cert_validation" {
  for_each = var.create_service && var.redirect_bare_domain && var.manage_bare_domain_validation_records ? {
    for record in aws_apprunner_custom_domain_association.bare[0].certificate_validation_records :
    record.name => record
  } : {}

  zone_id = data.aws_route53_zone.main.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 300
  records = [each.value.value]
}

# A zone apex cannot hold a CNAME, so it is an alias to App Runner's regional
# hosted zone.
data "aws_apprunner_hosted_zone_id" "main" {}

resource "aws_route53_record" "bare" {
  count = var.create_service && var.redirect_bare_domain ? 1 : 0

  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_apprunner_custom_domain_association.bare[0].dns_target
    zone_id                = data.aws_apprunner_hosted_zone_id.main.id
    evaluate_target_health = false
  }
}
