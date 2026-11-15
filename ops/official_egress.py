"""Fail deployment rather than silently returning official collectors to shared egress."""
import json


def validate_official_egress(annotations, region):
    if region != 'asia-northeast3':
        raise ValueError('Official-source fixed egress is provisioned only in Seoul')
    if annotations.get('run.googleapis.com/vpc-access-egress') != 'all-traffic':
        raise ValueError('Official sources require all-traffic Direct VPC egress')
    interfaces = json.loads(annotations.get('run.googleapis.com/network-interfaces', '[]'))
    if len(interfaces) != 1:
        raise ValueError('Expected one dedicated official-source network interface')
    interface = interfaces[0]
    if interface.get('network', '').split('/')[-1] != 'kbusan-official-egress':
        raise ValueError('Unexpected official-source egress network')
    if interface.get('subnetwork', '').split('/')[-1] != 'kbusan-official-seoul':
        raise ValueError('Unexpected official-source egress subnet')
