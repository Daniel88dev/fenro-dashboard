# App Runner writes "Container exit code" to the service log when the app dies,
# for example killed for running out of memory. Nothing inside the app can
# report that kill, so the log is watched instead. No request reaches the site.

locals {
  alerts_enabled = var.create_service && var.alert_email != ""
}

resource "aws_sns_topic" "alerts" {
  count = local.alerts_enabled ? 1 : 0
  name  = "${local.service_name}-alerts"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  count     = local.alerts_enabled ? 1 : 0
  topic_arn = aws_sns_topic.alerts[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_cloudwatch_log_metric_filter" "container_exit" {
  count          = local.alerts_enabled ? 1 : 0
  name           = "${local.service_name}-container-exit"
  log_group_name = "/aws/apprunner/${local.service_name}/${aws_apprunner_service.app[0].service_id}/service"
  pattern        = "\"Container exit code\""

  metric_transformation {
    name          = "ContainerExits"
    namespace     = "Fenro/AppRunner"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "container_exit" {
  count               = local.alerts_enabled ? 1 : 0
  alarm_name          = "${local.service_name}-container-exit"
  alarm_description   = "The app's container stopped (exit code in the App Runner service log). Exit code 137 means it ran out of memory."
  namespace           = "Fenro/AppRunner"
  metric_name         = "ContainerExits"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
}
