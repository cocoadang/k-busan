"""Validate the user's shared-egress choice before deploying any image."""
def validate_official_egress(annotations, region):
    if region != 'asia-northeast3':
        raise ValueError('Expected Seoul service')
    if annotations.get('run.googleapis.com/network-interfaces') or annotations.get('run.googleapis.com/vpc-access-connector'):
        raise ValueError('Dedicated egress was removed at user request; refuse reattachment')
    if annotations.get('run.googleapis.com/vpc-access-egress'):
        raise ValueError('Unexpected VPC egress configuration')
