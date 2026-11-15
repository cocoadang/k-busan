"""Exercise the real embedded system-client program with an offline HTTP response."""
import contextlib
import io
import json
from pathlib import Path
import ssl
import unittest
from unittest.mock import patch

PROGRAM=(Path(__file__).resolve().parents[1]/'src/collector/pythonCityFetch.ts').read_text(encoding='utf-8').split('String.raw`',1)[1].split('`;',1)[0]
class Response:
    def __init__(self,data,headers,status=200): self.data,self.headers,self.status=data,headers,status
    def read(self,limit): return self.data[:limit]
class SystemClientTests(unittest.TestCase):
    def execute(self,response):
        class Opener:
            def open(self,request,timeout): return response
        output=io.StringIO()
        with patch('urllib.request.build_opener',return_value=Opener()),patch('sys.stdin',io.StringIO(json.dumps({'url':'https://www.busan.go.kr/nbgosi','headers':{}}))),patch.dict('os.environ',{'NODE_EXTRA_CA_CERTS':''}),contextlib.redirect_stdout(output):
            exec(compile(PROGRAM,'city-system-client','exec'),{})
        return json.loads(output.getvalue())
    def test_complete_body(self):
        self.assertEqual(self.execute(Response(b'<html>ok</html>',{'Content-Length':'15'}))['status'],200)
    def test_partial_body_is_not_success(self):
        self.assertEqual(self.execute(Response(b'<html>partial',{'Content-Length':'100'})),{'error':'CITY_INCOMPLETE_BODY'})
    def test_oversized_body(self):
        self.assertEqual(self.execute(Response(b'x'*(2097152+1),{})),{'error':'OFFICIAL_RESPONSE_LIMIT'})
    def test_access_response_stays_explicit(self):
        self.assertEqual(self.execute(Response(b'forbidden',{},403))['status'],403)
if __name__=='__main__': unittest.main()
