import json
import unittest
from official_egress import validate_official_egress

class EgressDeploymentTests(unittest.TestCase):
    def config(self):
        return {'run.googleapis.com/vpc-access-egress':'all-traffic',
                'run.googleapis.com/network-interfaces':json.dumps([{'network':'kbusan-official-egress','subnetwork':'kbusan-official-seoul'}])}
    def test_accepts_exported_direct_vpc(self):
        validate_official_egress(self.config(),'asia-northeast3')
    def test_refuses_shared_private_only_wrong_network_and_region(self):
        configs=[{},dict(self.config(),**{'run.googleapis.com/vpc-access-egress':'private-ranges-only'}),
                 dict(self.config(),**{'run.googleapis.com/network-interfaces':json.dumps([{'network':'default','subnetwork':'kbusan-official-seoul'}])}),
                 dict(self.config(),**{'run.googleapis.com/network-interfaces':json.dumps([{'network':'kbusan-official-egress','subnetwork':'default'}])})]
        for config in configs:
            with self.subTest(config=config),self.assertRaises(ValueError): validate_official_egress(config,'asia-northeast3')
        with self.assertRaises(ValueError): validate_official_egress(self.config(),'asia-south1')

if __name__=='__main__': unittest.main()
