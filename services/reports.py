import datetime as dt
from data.storage import get_week_entries

def weekly_macros_summary(end_date=None, days=7):
    if end_date is None:
        end_date = dt.date.today()
    entries = get_week_entries(end_date, days)

    agg = {}
    for e in entries:
        d = e["date"]
        if d not in agg:
            agg[d] = {"kcal": 0.0, "p": 0.0, "c": 0.0, "g": 0.0}
        agg[d]["kcal"] += e["kcal"]
        agg[d]["p"] += e["p"]
        agg[d]["c"] += e["c"]
        agg[d]["g"] += e["g"]

    out = []
    for i in range(days):
        day = end_date - dt.timedelta(days=days-1-i)
        ds = str(day)
        out.append({"date": ds, **agg.get(ds, {"kcal":0.0,"p":0.0,"c":0.0,"g":0.0})})
    return out
