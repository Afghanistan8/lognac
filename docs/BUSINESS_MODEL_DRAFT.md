# Lognac business model input for cfo.ai

**Draft assumptions only.** These numbers are scenario inputs for cfo.ai, not observed sales, validated prices or a cfo.ai export. The cfo.ai output should replace this draft in the submission.

## Customer and offer

An initial buyer hypothesis is a UK hospital discharge or medicines optimisation team. The proposed paid product would prepare source-linked discrepancy review packets and follow-up tasks inside an existing clinical workflow. Pricing would be per hospital site per month with a controlled pilot before any clinical rollout. The fictional hackathon prototype is not deployable to those customers.

## Explicit scenario inputs (GBP per month)

| Input | Low | Base | High | How to validate |
| --- | ---: | ---: | ---: | --- |
| Paying sites | 2 | 6 | 12 | Signed pilot conversion and procurement cycle |
| Price per site | 600 | 900 | 1,200 | Buyer interviews and willingness to pay |
| Hosting, model and observability cost per site | 140 | 180 | 240 | Measured pilot usage and supplier invoices |
| Fixed operating cost | 8,000 | 12,000 | 18,000 | Staffing, governance, security, integration quotes |
| Starting cash | 150,000 | 150,000 | 150,000 | Actual financing position |

## Formulae and calculated checks

- Monthly revenue = sites × price per site.
- Monthly variable cost = sites × variable cost per site.
- Gross profit = revenue − variable cost.
- Gross margin = gross profit ÷ revenue.
- Operating cash flow before tax and financing = gross profit − fixed operating cost.
- Illustrative runway when operating cash flow is negative = starting cash ÷ monthly cash burn. This assumes constant sites, prices and costs and ignores working capital.

| Output | Low | Base | High |
| --- | ---: | ---: | ---: |
| Revenue | £1,200 | £5,400 | £14,400 |
| Variable cost | £280 | £1,080 | £2,880 |
| Gross profit | £920 | £4,320 | £11,520 |
| Gross margin | 76.7% | 80.0% | 80.0% |
| Monthly operating cash burn | £7,080 | £7,680 | £6,480 |
| Flat-run-rate runway | 21.2 months | 19.5 months | 23.1 months |

These are sensitivity examples, not forecasts. The counterintuitive lower runway in the base case reflects the higher fixed operating cost assumption. cfo.ai should test month-by-month sales timing, pilot duration, churn, NHS procurement delays, deployment costs and staffing before any business claim is made.

## cfo.ai task

Create a pricing, cost, revenue and runway model in [cfo.ai](https://cfo.ai/neathacks) with the assumptions above. Export the actual model or a shareable view and record its date, link, changed assumptions and the resulting figures in this repository. The hackathon requires the real cfo.ai artifact; this draft does not substitute for it.
