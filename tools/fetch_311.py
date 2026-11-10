"""Calgary 311 service requests from the last 14 days (City of Calgary open data, dataset iahh-g8bj) for the game map.
The open data places each request at its community's centre, so the game scatters them inside the community.
Writes city-stories/data/311.json: {"made": date, "from": date, "svc": [names], "agency": [names], "comm": [[code, name]], "r": [[id, yyyymmdd, svc, agency, comm, status, source]]}"""
import json, sys, urllib.request, urllib.parse, datetime
OUT = sys.argv[1] if len(sys.argv) > 1 else 'city-stories/data/311.json'
now = datetime.datetime.utcnow(); since = (now - datetime.timedelta(days=14)).strftime('%Y-%m-%dT00:00:00')
rows, off = [], 0
while True:
    q = urllib.parse.urlencode({'$select': 'service_request_id,requested_date,status_description,source,service_name,agency_responsible,comm_code,comm_name',
                                '$where': f"requested_date >= '{since}'", '$order': 'requested_date DESC', '$limit': 50000, '$offset': off})
    with urllib.request.urlopen('https://data.calgary.ca/resource/iahh-g8bj.json?' + q, timeout=180) as r: part = json.load(r)
    rows += part; off += len(part)
    if len(part) < 50000: break
print('requests', len(rows))
svc, ag, cm = {}, {}, {}
def ix(d, k): return d.setdefault(k, len(d))
out = []
for r in rows:
    code = (r.get('comm_code') or '').strip()
    if not code: continue
    out.append([r.get('service_request_id', ''), int((r.get('requested_date') or '')[:10].replace('-', '') or 0), ix(svc, r.get('service_name') or 'Other'),
                ix(ag, r.get('agency_responsible') or ''), ix(cm, (code, (r.get('comm_name') or '').title())), 0 if (r.get('status_description') or '').lower().startswith('open') else 1,
                (r.get('source') or '')[:12]])
json.dump({'made': now.strftime('%Y-%m-%d'), 'from': since[:10], 'svc': list(svc), 'agency': list(ag), 'comm': [list(k) for k in cm], 'r': out}, open(OUT, 'w'), separators=(',', ':'))
print('kept', len(out), 'services', len(svc), 'communities', len(cm))
