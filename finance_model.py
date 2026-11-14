"""AgriChain classroom scenario. All monetary amounts are KZT million."""
from decimal import Decimal
from pathlib import Path
import argparse
import json

D = Decimal
FIXED = [D('30.0'), D('36.6'), D('52.8')]
PRELAUNCH = D('18')
RESERVE = D('3')

def calculate(additions=(6, 13, 19), fixed_multiplier=D('1')):
    beginning = cumulative = monthly_cumulative = annual_deficit = monthly_deficit = D('0')
    low_month = 0
    rows, months = [], []
    for i, n in enumerate(additions):
        n = D(n)
        churn = beginning * D('.05')
        retained = beginning - churn
        avg = retained + n / 2
        ending = retained + n
        subscription, overage, onboarding = avg * D('2.16'), avg * D('.12'), n * D('.24')
        revenue = subscription + overage + onboarding
        variable, onboarding_cost = avg * D('.18'), n * D('.12')
        fixed = FIXED[i] * fixed_multiplier
        costs = fixed + variable + onboarding_cost
        cf = revenue - costs
        cumulative += cf
        annual_deficit = max(annual_deficit, -cumulative)
        month_sum = D('0')
        for month in range(1, 13):
            avg_month = retained + n * (D(month) - D('.5')) / 12
            month_cf = avg_month * D('2.10') / 12 + n * D('.12') / 12 - fixed / 12
            month_sum += month_cf
            monthly_cumulative += month_cf
            if -monthly_cumulative > monthly_deficit:
                monthly_deficit = -monthly_cumulative
                low_month = i * 12 + month
            months.append({'operating_month': i * 12 + month, 'cash_flow': month_cf,
                           'cumulative_operating_cash': monthly_cumulative})
        assert abs(month_sum - cf) < D('.0000000000000000001')
        period = i + 1.5
        pv = float(cf) / (1.25 ** period)
        rows.append(dict(year=i+1, beginning=beginning, new=n, churn=churn,
                         average=avg, ending=ending, subscription=subscription,
                         overage=overage, onboarding=onboarding, revenue=revenue,
                         variable=variable, onboarding_cost=onboarding_cost, fixed=fixed,
                         costs=costs, profit=cf, operating_cf=cf, cumulative_operating=cumulative,
                         cumulative_project=cumulative-PRELAUNCH,
                         break_even=(fixed / D('2.10')), discount_time=period, present_value=pv))
        beginning = ending
    annual_funding = PRELAUNCH + annual_deficit + RESERVE
    monthly_funding = PRELAUNCH + monthly_deficit + RESERVE
    cash = monthly_funding - PRELAUNCH
    for row in rows:
        row['opening_cash'] = cash
        cash += row['operating_cf']
        row['closing_cash'] = cash
    for month in months:
        month['cash_balance'] = monthly_funding - PRELAUNCH + month['cumulative_operating_cash']
    assert min(x['cash_balance'] for x in months) >= RESERVE - D('.0000001')
    return dict(rows=rows, months=months, npv=-18+sum(r['present_value'] for r in rows),
                annual_funding=annual_funding, monthly_funding=monthly_funding,
                monthly_funding_rounded_up=monthly_funding.quantize(D('.01'), rounding='ROUND_CEILING'),
                worst_operating_month=low_month, annual_deficit=annual_deficit,
                monthly_deficit=monthly_deficit, payback='Not reached within three operating years')

def serial(value):
    if isinstance(value, D): return float(value)
    raise TypeError(type(value))

def all_scenarios():
    base = calculate()
    assert base['rows'][0]['revenue'] == D('8.280')
    assert base['rows'][1]['operating_cf'] == D('-9.42000')
    assert base['rows'][2]['operating_cf'] == D('6.7365000')
    assert base['annual_funding'] == D('53.40000')
    assert abs(base['npv'] - (-36.75)) < .01
    return {'base': base, 'lower_adoption': calculate((4,9,13)),
            'higher_fixed_costs': calculate(fixed_multiplier=D('1.1')),
            'inputs': {'register_proxy':323, 'new_accounts':[6,13,19], 'adoption_rates':[.02,.04,.06],
                       'subscription_monthly':.18, 'annual_overage':.12, 'onboarding':.24,
                       'variable_per_account_year':.18, 'onboarding_cost':.12, 'churn':.05,
                       'discount_rate':.25, 'build_months':6, 'prelaunch':18, 'cash_floor':3},
            'fixed_cost_allocation': {'Team and payroll allowance':[24,30,42],
                                      'Hosting and maintenance':[2.4,3,4.8],
                                      'Sales and validation':[1.2,1.2,2.4],
                                      'Administration and compliance':[2.4,2.4,3.6]}}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--json', type=Path)
    args = parser.parse_args()
    model = all_scenarios()
    for name in ('base','lower_adoption','higher_fixed_costs'):
        s = model[name]
        print(name)
        for r in s['rows']:
            print(f"  Year {r['year']}: revenue {r['revenue']:.4f}, costs {r['costs']:.4f}, cash flow {r['operating_cf']:.4f}")
        print(f"  NPV {s['npv']:.4f}; annual funding {s['annual_funding']:.4f}; monthly funding {s['monthly_funding']:.4f}; lowest cash in operating month {s['worst_operating_month']}")
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(model, default=serial, indent=2), encoding='utf-8')
