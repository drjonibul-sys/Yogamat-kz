"""Тестовый сервер, имитирующий нужные методы Supabase (Auth OTP, verify, refresh, PostgREST allowed_emails). Только для проверок."""
import json, sys, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote
ROWS = {'admin@test.kz': {'email':'admin@test.kz','role':'admin','display_name':'Айдана','active':True},
        'coach@test.kz': {'email':'coach@test.kz','role':'trainer','display_name':'Тренер Нурлан','active':True}}
CODES = {}; TOKENS = {}; REFRESH = {}
KEY = 'x'*40
class H(BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def _send(self, code, data=None):
        body = b'' if data is None else json.dumps(data).encode()
        self.send_response(code)
        for k,v in {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*','Content-Type':'application/json'}.items(): self.send_header(k,v)
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_OPTIONS(self): self._send(204)
    def body(self):
        n=int(self.headers.get('Content-Length') or 0); return json.loads(self.rfile.read(n) or b'{}') if n else {}
    def email_from_token(self):
        t=(self.headers.get('Authorization') or '').replace('Bearer ',''); return TOKENS.get(t)
    def route(self, method):
        u=urlparse(self.path); p=u.path; q=parse_qs(u.query)
        if self.headers.get('apikey')!=KEY: return self._send(401,{'message':'bad key'})
        if p=='/__codes' : return self._send(200, CODES)
        if p=='/__set' and method=='POST':
            b=self.body(); ROWS[b['email']]=b; return self._send(200,{})
        if p=='/auth/v1/otp':
            b=self.body(); CODES[b['email']]='123456'; return self._send(200,{})
        if p=='/auth/v1/verify':
            b=self.body()
            if CODES.get(b['email'])!=b.get('token'): return self._send(403,{'error_description':'Token has expired or is invalid'})
            tok=uuid.uuid4().hex; ref=uuid.uuid4().hex; TOKENS[tok]=b['email']; REFRESH[ref]=b['email']
            return self._send(200,{'access_token':tok,'refresh_token':ref,'expires_in':3600,'user':{'email':b['email']}})
        if p=='/auth/v1/token':
            b=self.body(); e=REFRESH.get(b.get('refresh_token'))
            if not e: return self._send(400,{'error_description':'Invalid Refresh Token'})
            tok=uuid.uuid4().hex; TOKENS[tok]=e; return self._send(200,{'access_token':tok,'refresh_token':b['refresh_token'],'expires_in':3600})
        if p=='/auth/v1/logout': return self._send(204)
        if p=='/rest/v1/rpc/email_allowed':
            b=self.body(); r=ROWS.get(b['p_email'].lower()); return self._send(200, bool(r and r['active']))
        if p=='/rest/v1/allowed_emails':
            e=self.email_from_token()
            if not e: return self._send(401,{'message':'JWT required'})
            me=ROWS.get(e); 
            if not me or not me['active']: return self._send(200, [r for r in ROWS.values() if r['email']==e])
            if method=='GET': return self._send(200, list(ROWS.values()))
            if me['role']!='admin': return self._send(403,{'message':'forbidden'})
            if method=='POST': b=self.body(); ROWS[b['email']]=b; return self._send(201)
            if method=='DELETE':
                v=unquote(q['email'][0].replace('eq.','',1)); ROWS.pop(v,None); return self._send(204)
        return self._send(404,{'message':'not found '+p})
    def do_GET(self): self.route('GET')
    def do_POST(self): self.route('POST')
    def do_DELETE(self): self.route('DELETE')
if __name__=='__main__':
    ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
