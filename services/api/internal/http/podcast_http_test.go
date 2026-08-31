package http_test

import (
	"bytes"
	"net/http"
	"testing"
)

func TestPodcastPublishingLifecycleAndPublicLibrary(t *testing.T) {
	handler := televisionServer()
	createReadyAsset(t, handler, "audio", "episode.mp3", "id_1")
	createReadyAsset(t, handler, "transcript", "episode.txt", "id_2")

	podcast := request(handler, http.MethodPost, "/media/podcasts", `{"title":"The Kurasikapa Brief","slug":"the-brief","locale":"en","summary":"Context behind the week's defining stories","author":"Kurasikapa Newsroom"}`, true)
	if podcast.Code != http.StatusCreated {
		t.Fatalf("podcast: %d %s", podcast.Code, podcast.Body.String())
	}
	publishedPodcast := request(handler, http.MethodPost, "/media/podcasts/id_3/publish", `{}`, true)
	if publishedPodcast.Code != http.StatusOK {
		t.Fatalf("publish podcast: %d %s", publishedPodcast.Code, publishedPodcast.Body.String())
	}
	episode := request(handler, http.MethodPost, "/media/episodes", `{"podcastID":"id_3","title":"Market close","slug":"market-close","locale":"en","summary":"Markets and household prices","audioAssetID":"id_1","transcriptAssetID":"id_2","durationSeconds":180,"chapters":[{"title":"Opening","startsAtSec":0}]}`, true)
	if episode.Code != http.StatusCreated {
		t.Fatalf("episode: %d %s", episode.Code, episode.Body.String())
	}
	publishedEpisode := request(handler, http.MethodPost, "/media/episodes/id_4/publish", `{}`, true)
	if publishedEpisode.Code != http.StatusOK {
		t.Fatalf("publish episode: %d %s", publishedEpisode.Code, publishedEpisode.Body.String())
	}
	library := request(handler, http.MethodGet, "/public/en/podcasts", "", false)
	if library.Code != http.StatusOK || !bytes.Contains(library.Body.Bytes(), []byte(`"audioUrl"`)) || !bytes.Contains(library.Body.Bytes(), []byte("Market close")) {
		t.Fatalf("library: %d %s", library.Code, library.Body.String())
	}
}

func TestPodcastEndpointsRejectInvalidAndUnauthorisedRequests(t *testing.T) {
	handler := televisionServer()
	for _, path := range []string{"/media/podcasts", "/media/podcasts/missing/publish", "/media/episodes", "/media/episodes/missing/publish"} {
		if response := request(handler, http.MethodPost, path, `{}`, false); response.Code != http.StatusForbidden {
			t.Fatalf("unauthorised %s: %d", path, response.Code)
		}
	}
	for _, path := range []string{"/media/podcasts", "/media/episodes"} {
		if response := request(handler, http.MethodPost, path, `{`, true); response.Code != http.StatusBadRequest {
			t.Fatalf("malformed %s: %d %s", path, response.Code, response.Body.String())
		}
	}
	if response := request(handler, http.MethodPost, "/media/podcasts", `{"title":"","summary":""}`, true); response.Code != http.StatusBadRequest {
		t.Fatalf("invalid podcast: %d %s", response.Code, response.Body.String())
	}
	if response := request(handler, http.MethodPost, "/media/podcasts/missing/publish", `{}`, true); response.Code != http.StatusNotFound {
		t.Fatalf("missing podcast publish: %d %s", response.Code, response.Body.String())
	}
	if response := request(handler, http.MethodPost, "/media/episodes", `{"podcastID":"missing","title":"Episode"}`, true); response.Code != http.StatusNotFound {
		t.Fatalf("missing podcast: %d %s", response.Code, response.Body.String())
	}
	if response := request(handler, http.MethodPost, "/media/episodes/missing/publish", `{}`, true); response.Code != http.StatusNotFound {
		t.Fatalf("missing episode publish: %d %s", response.Code, response.Body.String())
	}
}

func TestPodcastEpisodeCannotPublishWithoutAccessibleAssets(t *testing.T) {
	handler := televisionServer()
	created := request(handler, http.MethodPost, "/media/podcasts", `{"title":"The Brief","summary":"Daily context"}`, true)
	if created.Code != http.StatusCreated {
		t.Fatalf("create podcast: %d %s", created.Code, created.Body.String())
	}
	if published := request(handler, http.MethodPost, "/media/podcasts/id_1/publish", `{}`, true); published.Code != http.StatusOK {
		t.Fatalf("publish podcast: %d %s", published.Code, published.Body.String())
	}
	episode := request(handler, http.MethodPost, "/media/episodes", `{"podcastID":"id_1","title":"Episode"}`, true)
	if episode.Code != http.StatusCreated {
		t.Fatalf("create episode: %d %s", episode.Code, episode.Body.String())
	}
	if published := request(handler, http.MethodPost, "/media/episodes/id_2/publish", `{}`, true); published.Code != http.StatusConflict {
		t.Fatalf("publish inaccessible episode: %d %s", published.Code, published.Body.String())
	}
}

func createReadyAsset(t *testing.T, handler http.Handler, kind, filename, id string) {
	t.Helper()
	created := request(handler, http.MethodPost, "/media/assets/uploads", `{"kind":"`+kind+`","filename":"`+filename+`","locale":"en"}`, true)
	if created.Code != http.StatusCreated {
		t.Fatalf("create %s: %d %s", kind, created.Code, created.Body.String())
	}
	completed := request(handler, http.MethodPost, "/media/assets/"+id+"/complete", `{"publicID":"kurasikapa/media/`+id+`","secureURL":"https://res.cloudinary.test/`+filename+`","signature":"signed","version":1,"bytes":2048,"durationSeconds":180}`, true)
	if completed.Code != http.StatusOK {
		t.Fatalf("complete %s: %d %s", kind, completed.Code, completed.Body.String())
	}
}
