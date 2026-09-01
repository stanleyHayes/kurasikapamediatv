package http

import "net/http"

func (d Deps) handlePublicAPISpec(w http.ResponseWriter, _ *http.Request) {
	publicAPIHeaders(w)
	w.Header().Set("Cache-Control", "public, max-age=3600")
	writeJSON(w, d.Log, http.StatusOK, publicAPISpec())
}

func publicAPISpec() map[string]any {
	return map[string]any{
		"openapi": "3.1.0",
		"info": map[string]any{
			"title": "Kurasikapa Media public API", "version": "1.0.0",
			"description": "Published Kurasikapa journalism for syndication and reader applications.",
		},
		"paths": map[string]any{
			"/v1/{locale}/articles": map[string]any{"get": map[string]any{
				"summary": "List published articles", "operationId": "listPublishedArticles",
				"parameters": publicAPIListParameters(),
				"responses":  publicAPIResponses("A cursor-paginated article collection"),
			}},
			"/v1/{locale}/articles/{slug}": map[string]any{"get": map[string]any{
				"summary": "Get one published article", "operationId": "getPublishedArticle",
				"parameters": []any{pathParameter("locale", "Article locale"), pathParameter("slug", "Article slug")},
				"responses":  publicAPIResponses("The published article and approved Markdown body"),
			}},
		},
	}
}

func publicAPIListParameters() []any {
	return []any{
		pathParameter("locale", "Article locale"),
		queryParameter("after", "Opaque cursor from pagination.nextCursor", "string"),
		queryParameter("limit", "Page size from 1 to 50; defaults to 12", "integer"),
		queryParameter("categoryId", "Optional category identifier", "string"),
	}
}

func pathParameter(name, description string) map[string]any {
	return map[string]any{
		"name": name, "in": "path", "required": true, "description": description,
		"schema": map[string]string{"type": "string"},
	}
}

func queryParameter(name, description, kind string) map[string]any {
	return map[string]any{
		"name": name, "in": "query", "required": false, "description": description,
		"schema": map[string]string{"type": kind},
	}
}

func publicAPIResponses(description string) map[string]any {
	return map[string]any{
		"200": map[string]any{"description": description},
		"404": map[string]any{"description": "The published resource was not found"},
		"500": map[string]any{"description": "The request could not be completed"},
	}
}
