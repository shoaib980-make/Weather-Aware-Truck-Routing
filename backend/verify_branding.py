import requests

for port in [5173, 8000]:
    base = f'http://127.0.0.1:{port}'
    print(f'=== Testing Port {port} ===')
    r_html = requests.get(f'{base}/')
    print('HTML status:', r_html.status_code)
    assert '<title>SafeHaul RouteIQ | Weather-Aware Truck Routing</title>' in r_html.text, 'Title mismatch!'
    assert 'href="/favicon.svg"' in r_html.text, 'favicon.svg link missing!'
    assert 'href="/favicon.ico"' in r_html.text, 'favicon.ico link missing!'
    print('-> Tab title & favicon link tags VERIFIED!')

    r_svg = requests.get(f'{base}/favicon.svg')
    print('favicon.svg status:', r_svg.status_code, 'Content-Type:', r_svg.headers.get('content-type'))
    assert r_svg.status_code == 200, 'favicon.svg failed to load'
    assert '<svg' in r_svg.text, 'favicon.svg is not valid SVG'
    print('-> favicon.svg loads successfully (status 200, valid SVG)!')

    r_ico = requests.get(f'{base}/favicon.ico')
    print('favicon.ico status:', r_ico.status_code, 'Bytes:', len(r_ico.content))
    assert r_ico.status_code == 200, 'favicon.ico failed to load'
    assert len(r_ico.content) > 100, 'favicon.ico is empty'
    print('-> favicon.ico loads successfully (status 200)!')

print('\nALL BRANDING CHECKS PASSED ON BOTH VITE AND DJANGO!')
