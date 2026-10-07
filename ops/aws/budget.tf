# ─────────────────────────────────────────────────────────────
# Account Guardrail: $5 Monthly Budget with Tiered Alerts
# ─────────────────────────────────────────────────────────────
resource "aws_budgets_budget" "monthly_budget" {
  name              = "${var.project_name}-monthly-5-usd-budget"
  budget_type       = "COST"
  limit_amount      = "5.0"
  limit_unit        = "USD"
  time_period_start = "2024-01-01_00:00"
  time_unit         = "MONTHLY"

  cost_types {
    include_credit             = false
    include_discount           = true
    include_other_subscription = true
    include_recurring          = true
    include_refund             = false
    include_subscription       = true
    include_support            = true
    include_tax                = true
    include_upfront            = true
    use_blended                = false
  }

  # Alert at 80% ($4.00) forecasted spend
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }

  # Alert at 100% ($5.00) actual spend
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }
}
