package mongo

import (
	domainmedia "github.com/kurasikapa/api/internal/domain/media"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func assetPointer(raw *string) *shared.AssetID {
	if raw == nil {
		return nil
	}
	id := shared.AssetID(*raw)
	return &id
}
func stringPointer(id *shared.AssetID) *string {
	if id == nil {
		return nil
	}
	raw := id.String()
	return &raw
}
func presenterToDomain(d presenterDoc) domainmedia.Presenter {
	return domainmedia.ReconstitutePresenter(domainmedia.PresenterState{
		ID: shared.PresenterID(d.ID), Name: d.Name, Slug: d.Slug, Locale: d.Locale,
		Role: d.Role, Biography: d.Biography, PortraitAssetID: assetPointer(d.PortraitAssetID),
		Published: d.Published, CreatedBy: shared.UserID(d.CreatedBy),
	})
}
func presenterToDoc(p domainmedia.Presenter) presenterDoc {
	s := p.State()
	return presenterDoc{ID: s.ID.String(), Name: s.Name, Slug: s.Slug, Locale: s.Locale,
		Role: s.Role, Biography: s.Biography, PortraitAssetID: stringPointer(s.PortraitAssetID),
		Published: s.Published, CreatedBy: s.CreatedBy.String()}
}
func programmeToDomain(d programmeDoc) domainmedia.Programme {
	hosts := make([]shared.PresenterID, len(d.PresenterIDs))
	for i, id := range d.PresenterIDs {
		hosts[i] = shared.PresenterID(id)
	}
	return domainmedia.ReconstituteProgramme(domainmedia.ProgrammeState{
		ID: shared.ProgrammeID(d.ID), Title: d.Title, Slug: d.Slug, Locale: d.Locale,
		Summary: d.Summary, Category: d.Category, PresenterIDs: hosts,
		ArtworkAssetID: assetPointer(d.ArtworkAssetID), Published: d.Published,
		CreatedBy: shared.UserID(d.CreatedBy),
	})
}
func programmeToDoc(p domainmedia.Programme) programmeDoc {
	s := p.State()
	hosts := make([]string, len(s.PresenterIDs))
	for i, id := range s.PresenterIDs {
		hosts[i] = id.String()
	}
	return programmeDoc{ID: s.ID.String(), Title: s.Title, Slug: s.Slug, Locale: s.Locale,
		Summary: s.Summary, Category: s.Category, PresenterIDs: hosts,
		ArtworkAssetID: stringPointer(s.ArtworkAssetID), Published: s.Published, CreatedBy: s.CreatedBy.String()}
}
func scheduleToDomain(d scheduleSlotDoc) domainmedia.ScheduleSlot {
	return domainmedia.ReconstituteScheduleSlot(domainmedia.ScheduleSlotState{
		ID: shared.ScheduleSlotID(d.ID), ProgrammeID: shared.ProgrammeID(d.ProgrammeID), Locale: d.Locale,
		StartsAt: d.StartsAt, EndsAt: d.EndsAt, IsLive: d.IsLive, State: domainmedia.ScheduleState(d.State),
		ReplayAssetID: assetPointer(d.ReplayAssetID), CaptionAssetID: assetPointer(d.CaptionAssetID),
		CreatedBy: shared.UserID(d.CreatedBy),
	})
}
func scheduleToDoc(slot domainmedia.ScheduleSlot) scheduleSlotDoc {
	s := slot.State()
	return scheduleSlotDoc{ID: s.ID.String(), ProgrammeID: s.ProgrammeID.String(), Locale: s.Locale,
		StartsAt: s.StartsAt, EndsAt: s.EndsAt, IsLive: s.IsLive, State: string(s.State),
		ReplayAssetID: stringPointer(s.ReplayAssetID), CaptionAssetID: stringPointer(s.CaptionAssetID),
		CreatedBy: s.CreatedBy.String()}
}
