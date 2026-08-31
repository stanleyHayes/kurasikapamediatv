package editorial

import (
	"html"
	"regexp"
	"strings"
	"unicode/utf8"
)

const maxNarrationCharacters = 100_000

var (
	markdownImage = regexp.MustCompile(`!\[([^]]*)\]\([^)]+\)`)
	markdownLink  = regexp.MustCompile(`\[([^]]+)\]\([^)]+\)`)
	htmlTag       = regexp.MustCompile(`<[^>]+>`)
	bareURL       = regexp.MustCompile(`https?://\S+`)
	linePrefix    = regexp.MustCompile(`(?m)^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s*`)
	markdownMark  = strings.NewReplacer("**", "", "__", "", "~~", "", "`", "", "*", "", "_", "")
)

// NarrationText turns editor-authored Markdown into plain spoken copy.
func NarrationText(title, body string) string {
	text := markdownImage.ReplaceAllString(body, "$1")
	text = markdownLink.ReplaceAllString(text, "$1")
	text = htmlTag.ReplaceAllString(text, " ")
	text = bareURL.ReplaceAllString(text, " ")
	text = linePrefix.ReplaceAllString(text, "")
	text = markdownMark.Replace(text)
	text = strings.Join(strings.Fields(html.UnescapeString(text)), " ")
	title = strings.Join(strings.Fields(markdownMark.Replace(title)), " ")

	return strings.TrimSpace(title + ". " + text)
}

func narrationTooLong(text string) bool {
	return utf8.RuneCountInString(text) > maxNarrationCharacters
}
