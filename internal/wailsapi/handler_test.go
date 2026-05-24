package wailsapi

import (
	"encoding/base64"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestFetchPageTitleFollowsRedirect(t *testing.T) {
	client := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch req.URL.Path {
			case "/source":
				return &http.Response{
					StatusCode: http.StatusMovedPermanently,
					Header: http.Header{
						"Location": []string{"http://example.test/final"},
					},
					Body: io.NopCloser(strings.NewReader("")),
					Request: req,
				}, nil
			case "/final":
				return &http.Response{
					StatusCode: http.StatusOK,
					Header: http.Header{
						"Content-Type": []string{"text/html; charset=utf-8"},
					},
					Body: io.NopCloser(strings.NewReader("<html><head><title>Redirected Title</title></head><body></body></html>")),
					Request: req,
				}, nil
			default:
				t.Fatalf("unexpected path requested: %s", req.URL.Path)
				return nil, nil
			}
		}),
	}

	title, err := fetchPageTitleWithClient(client, "http://example.test/source")
	if err != nil {
		t.Fatalf("expected redirecting title fetch to succeed, got error: %v", err)
	}

	if title != "Redirected Title" {
		t.Fatalf("expected redirected title, got %q", title)
	}
}

func TestFetchFaviconPrefersDeclaredIcon(t *testing.T) {
	iconBytes := []byte("png-bytes")

	client := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch req.URL.String() {
			case "http://example.test/repo":
				return &http.Response{
					StatusCode: http.StatusOK,
					Header: http.Header{
						"Content-Type": []string{"text/html; charset=utf-8"},
					},
					Body: io.NopCloser(strings.NewReader(`<html><head><link rel="icon" href="/assets/img/favicon.png"></head><body></body></html>`)),
					Request: req,
				}, nil
			case "http://example.test/assets/img/favicon.png":
				return &http.Response{
					StatusCode: http.StatusOK,
					Header: http.Header{
						"Content-Type": []string{"image/png"},
					},
					Body: io.NopCloser(strings.NewReader(string(iconBytes))),
					Request: req,
				}, nil
			default:
				t.Fatalf("unexpected URL requested: %s", req.URL.String())
				return nil, nil
			}
		}),
	}

	dataURI, err := fetchFaviconWithClient(client, "http://example.test/repo")
	if err != nil {
		t.Fatalf("expected favicon fetch to succeed, got %v", err)
	}

	expected := "data:image/png;base64," + base64.StdEncoding.EncodeToString(iconBytes)
	if dataURI != expected {
		t.Fatalf("expected %q, got %q", expected, dataURI)
	}
}
