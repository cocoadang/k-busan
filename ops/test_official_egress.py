import unittest
from official_egress import validate_official_egress
class SharedEgressTests(unittest.TestCase):
    def test_accepts_shared_egress(self):
        validate_official_egress({},'asia-northeast3')
    def test_refuses_paid_path_reattachment(self):
        for key in ['run.googleapis.com/network-interfaces','run.googleapis.com/vpc-access-connector','run.googleapis.com/vpc-access-egress']:
            with self.subTest(key=key),self.assertRaises(ValueError):validate_official_egress({key:'unexpected'},'asia-northeast3')
if __name__=='__main__':unittest.main()
