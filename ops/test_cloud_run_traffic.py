import unittest

from cloud_run_traffic import candidate_url, serving_revision


OLD = "busan-redevelopment-news-monitor-previous"
FAILED = "busan-redevelopment-news-monitor-failed"
NEW = "busan-redevelopment-news-monitor-new"
URL = "https://candidate---busan-redevelopment-news-monitor-abcdef-an.a.run.app"
def svc(*targets):
    return {"status": {"latestReadyRevisionName": FAILED, "traffic": list(targets)}}


class CloudRunTrafficTest(unittest.TestCase):
    def test_failure_candidate_ready_but_actual_baseline_serves(self):
        state = svc({"revisionName": OLD, "percent": 100}, {"revisionName": FAILED, "tag": "candidate"})
        self.assertEqual(serving_revision(state), OLD)
        self.assertEqual(serving_revision(svc({"revisionName": OLD, "percent": 100, "latestRevision": True})), OLD)

    def test_split_unresolved_or_ambiguous_status_is_rejected(self):
        for state in (
            svc({"revisionName": OLD, "percent": 90}, {"revisionName": NEW, "percent": 10}),
            svc({"revisionName": OLD, "percent": "100"}),
            svc({"latestRevision": True, "percent": 100}),
            svc({"revisionName": OLD, "percent": 0}),
            {"spec": {"traffic": [{"revisionName": OLD, "percent": 100}]}},
        ):
            with self.subTest(state=state), self.assertRaises(ValueError):
                serving_revision(state)

    def test_only_exact_candidate_https_tag_is_used(self):
        current = {"revisionName": OLD, "percent": 100}
        new = {"revisionName": NEW, "percent": 0, "tag": "candidate", "url": URL + "/"}
        self.assertEqual(candidate_url(svc(current, new), NEW, OLD), URL)
        for wrong in ({**new, "revisionName": FAILED}, {**new, "url": "https://example.org"},
                      {**new, "url": URL + "/wrong"}, {**new, "percent": 1}):
            with self.subTest(wrong=wrong), self.assertRaises(ValueError):
                candidate_url(svc(current, wrong), NEW, OLD)
        with self.assertRaises(ValueError):
            candidate_url(svc({"revisionName": FAILED, "percent": 100}, new), NEW, OLD)
        with self.assertRaises(ValueError):
            candidate_url(svc(current, new, new), NEW, OLD)


if __name__ == "__main__":
    unittest.main()
