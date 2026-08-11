package editorial

import "strings"

// ExcerptFrom is the standfirst a listing shows under a headline.
//
// Articles carry no separate excerpt field. Taking the opening of the body is
// what a newsroom would do by hand. Cuts on a word boundary so a card never
// ends mid-word.
func ExcerptFrom(body string, limit int) string {
	flat := strings.Join(strings.Fields(body), " ")
	runes := []rune(flat)
	if len(runes) <= limit {
		return flat
	}

	cut := runes[:limit]
	lastSpace := -1
	for i, r := range cut {
		if r == ' ' {
			lastSpace = i
		}
	}
	if lastSpace > 0 {
		cut = cut[:lastSpace]
	}

	return string(cut) + "\u2026"
}
