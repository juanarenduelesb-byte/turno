import urllib.request,urllib.parse,json,re,http.cookiejar,sys
class VBF:
    def __init__(s,page):
        s.cj=http.cookiejar.CookieJar(); s.op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(s.cj)); s.op.addheaders=[('User-Agent','Mozilla/5.0')]
        h=s.op.open(page,timeout=40).read().decode('utf8','ignore')
        s.nonce=re.search(r'vbf_vars = \{"nonce":"([^"]+)"',h).group(1); s.ajax=re.search(r'"ajax_url":"([^"]+)"',h).group(1).replace('\\/','/')
    def call(s,**kw):
        b=urllib.parse.urlencode(dict(action='bearer_authentication_with_params',nonce=s.nonce,**kw)).encode()
        return json.loads(s.op.open(s.ajax,data=b,timeout=90).read())
