package main

import (
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

func previewRecords(now time.Time) (map[string][]bson.M, error) {
	pages, err := managedPages(now)
	if err != nil {
		return nil, err
	}
	return map[string][]bson.M{
		"site_pages":     pages,
		"presenters":     presenters(),
		"programmes":     programmes(),
		"schedule_slots": schedule(now),
	}, nil
}

func managedPages(now time.Time) ([]bson.M, error) {
	definitions := []struct {
		id, key, title string
		entries        []bson.M
	}{
		{"faq:en", "faq", "Frequently asked questions", []bson.M{
			{"id": "editorial-independence", "title": "How does Kurasikapa protect editorial independence?", "summary": "The newsroom separates editorial judgement from commercial influence.", "body": "Editors decide what is reported and how it is presented. Advertising and sponsored work are labelled clearly, and commercial partners do not approve newsroom coverage."},
			{"id": "corrections", "title": "How can I request a correction?", "summary": "Send the article link and the specific fact you believe needs review.", "body": "Use the contact page to reach the editorial desk. The team reviews supporting evidence, updates confirmed errors transparently and records material corrections on the article."},
		}},
		{"help:en", "help", "Help centre", []bson.M{
			{"id": "save-story", "title": "Save a story for later", "summary": "Keep important reporting in your private reading list.", "body": "Sign in, open any published article and use Save. Return to saved reporting from your profile and remove an item whenever it is no longer useful."},
			{"id": "account-access", "title": "Recover access to your account", "summary": "Use secure password recovery from the sign-in page.", "body": "Request a recovery link using the email attached to your account. Links expire and can only be used once."},
		}},
		{"careers:en", "careers", "Careers", []bson.M{
			{"id": "multimedia-producer", "title": "Multimedia producer", "summary": "Accra · Full time · Editorial production", "body": "Shape field reporting into clear video, audio and digital packages. The role needs strong news judgement, confident editing skills and an appropriate portfolio."},
			{"id": "audience-editor", "title": "Audience editor", "summary": "Accra or remote in Ghana · Full time", "body": "Help the newsroom understand how readers find, use and respond to its journalism across newsletters, social distribution, analytics and community feedback."},
		}},
	}
	pages := make([]bson.M, 0, len(definitions))
	for _, definition := range definitions {
		body, err := managedBody(definition.entries)
		if err != nil {
			return nil, fmt.Errorf("building %s page: %w", definition.key, err)
		}
		pages = append(pages, bson.M{"_id": definition.id, "key": definition.key, "locale": "en", "title": definition.title, "lead": "", "body": body, "updatedAt": now, "demoSeed": previewTag})
	}
	return pages, nil
}

func presenters() []bson.M {
	return []bson.M{
		{"_id": "demo_presenter_ama", "name": "Ama Nyarko — Preview profile", "slug": "ama-nyarko-preview", "locale": "en", "role": "Host, The Civic Desk", "biography": "Client-preview biography. Replace with a verified team member, portrait and approved biography before launch.", "portraitAssetId": nil, "published": true, "createdBy": "usr_demo_author", "demoSeed": previewTag},
		{"_id": "demo_presenter_kojo", "name": "Kojo Mensah — Preview profile", "slug": "kojo-mensah-preview", "locale": "en", "role": "Anchor, Evening Bulletin", "biography": "Client-preview biography. Replace with verified newsroom information before launch.", "portraitAssetId": nil, "published": true, "createdBy": "usr_demo_author", "demoSeed": previewTag},
		{"_id": "demo_presenter_adwoa", "name": "Adwoa Sarpong — Preview profile", "slug": "adwoa-sarpong-preview", "locale": "en", "role": "Host, Culture Exchange", "biography": "Client-preview biography. Replace with verified presenter details before launch.", "portraitAssetId": nil, "published": true, "createdBy": "usr_demo_author", "demoSeed": previewTag},
	}
}

func programmes() []bson.M {
	return []bson.M{
		{"_id": "demo_programme_civic", "title": "The Civic Desk", "slug": "the-civic-desk", "locale": "en", "summary": "A weekly examination of public decisions, essential services and the people responsible for delivering them.", "category": "Current affairs", "presenterIds": []string{"demo_presenter_ama"}, "artworkAssetId": nil, "published": true, "createdBy": "usr_demo_author", "demoSeed": previewTag},
		{"_id": "demo_programme_evening", "title": "Evening Bulletin", "slug": "evening-bulletin", "locale": "en", "summary": "The day’s verified headlines, field reports and concise context from Ghana and across West Africa.", "category": "News", "presenterIds": []string{"demo_presenter_kojo"}, "artworkAssetId": nil, "published": true, "createdBy": "usr_demo_author", "demoSeed": previewTag},
		{"_id": "demo_programme_culture", "title": "Culture Exchange", "slug": "culture-exchange", "locale": "en", "summary": "Conversations with artists, makers and cultural organisers about the work shaping contemporary Ghana.", "category": "Arts & culture", "presenterIds": []string{"demo_presenter_adwoa"}, "artworkAssetId": nil, "published": true, "createdBy": "usr_demo_author", "demoSeed": previewTag},
	}
}

func schedule(now time.Time) []bson.M {
	slot := func(id, programme string, days float64, live bool) bson.M {
		start := now.Add(time.Duration(days * float64(24*time.Hour)))
		return bson.M{"_id": id, "programmeId": programme, "locale": "en", "startsAt": start, "endsAt": start.Add(time.Hour), "isLive": live, "state": "scheduled", "replayAssetId": nil, "captionAssetId": nil, "createdBy": "usr_demo_author", "demoSeed": previewTag}
	}
	return []bson.M{
		slot("demo_slot_evening", "demo_programme_evening", 1, true),
		slot("demo_slot_civic", "demo_programme_civic", 2, true),
		slot("demo_slot_culture", "demo_programme_culture", 3, false),
	}
}
