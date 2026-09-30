import httpx

from backend import updates


def releases(*tags, draft=()):
    return [{"tag_name": tag, "draft": tag in draft, "html_url": "https://evil.example/x"} for tag in tags]


def client_for(payload, status=200):
    return httpx.MockTransport(lambda request: httpx.Response(status, json=payload))


def test_newest_compares_numbers_not_text_and_skips_drafts_and_junk():
    assert updates.newest(releases("v0.9.0", "v0.10.0", "v0.2.0")) == "0.10.0"
    assert updates.newest(releases("v0.1.0", "v0.3.0", draft=("v0.3.0",))) == "0.1.0"
    assert updates.newest(releases("nightly", "v1.0.0-evil<script>")) is None
    assert updates.newest({"message": "rate limited"}) is None


def test_check_reports_a_newer_version_and_only_shows_our_own_page():
    result = updates.check("0.1.0", client_for(releases("v0.2.0", "v0.1.0")))
    assert result == {"ok": True, "current": "0.1.0", "latest": "0.2.0", "newer": True, "page": updates.RELEASES_PAGE}
    assert "evil" not in str(result)


def test_check_with_the_newest_version_installed():
    assert updates.check("0.2.0", client_for(releases("v0.2.0")))["newer"] is False


def test_check_fails_quietly():
    assert updates.check("0.1.0", client_for([], status=403)) == {"ok": False}
    assert updates.check("0.1.0", client_for(releases("nightly"))) == {"ok": False}

    def offline(request):
        raise httpx.ConnectError("no network")
    assert updates.check("0.1.0", httpx.MockTransport(offline)) == {"ok": False}
    assert updates.check("0.1.0", httpx.MockTransport(lambda r: httpx.Response(200, text="not json"))) == {"ok": False}
