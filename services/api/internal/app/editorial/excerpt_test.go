package editorial

import (
	"strings"
	"testing"
)

func TestReadingTimeMinutes(t *testing.T) {
	t.Parallel()

	if got := ReadingTimeMinutes("short update"); got != 1 {
		t.Fatalf("short update = %d minutes", got)
	}
	if got := ReadingTimeMinutes(strings.Repeat("word ", 201)); got != 2 {
		t.Fatalf("201 words = %d minutes", got)
	}
}
