package http

import (
	"net/http"

	apprevenue "github.com/kurasikapa/api/internal/app/revenue"
	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func (d Deps) handleCreateProduct(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	var input revenue.ProductState
	if err = decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	product, err := d.CreateProduct.Execute(r.Context(), actor, input)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusCreated, product.State())
}
func (d Deps) handleActivateProduct(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	product, err := d.ActivateProduct.Execute(r.Context(), actor, shared.ProductID(r.PathValue("id")))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, product.State())
}
func (d Deps) handleListProducts(w http.ResponseWriter, r *http.Request) { d.writeProducts(w, r, nil) }
func (d Deps) handleManageProducts(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	d.writeProducts(w, r, &actor)
}
func (d Deps) writeProducts(w http.ResponseWriter, r *http.Request, actor *identity.Actor) {
	items, err := d.ListProducts.Execute(r.Context(), actor)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	views := make([]revenue.ProductState, len(items))
	for i, item := range items {
		views[i] = item.State()
	}
	writeJSON(w, d.Log, http.StatusOK, map[string]any{"items": views})
}
func (d Deps) handleStartProductOrder(w http.ResponseWriter, r *http.Request) {
	var input apprevenue.StartProductOrderInput
	if err := decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	result, err := d.StartProductOrder.Execute(r.Context(), input)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusCreated, result)
}
func (d Deps) handleSubmitClassified(w http.ResponseWriter, r *http.Request) {
	var input apprevenue.SubmitClassifiedInput
	if err := decode(r, &input); err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	result, err := d.SubmitClassified.Execute(r.Context(), input)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusCreated, result)
}
func (d Deps) handleListClassifieds(w http.ResponseWriter, r *http.Request) {
	d.writeClassifieds(w, r, nil)
}
func (d Deps) handleManageClassifieds(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	d.writeClassifieds(w, r, &actor)
}
func (d Deps) writeClassifieds(w http.ResponseWriter, r *http.Request, actor *identity.Actor) {
	items, err := d.ListClassifieds.Execute(r.Context(), actor)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	views := make([]revenue.ClassifiedState, len(items))
	for i, item := range items {
		views[i] = item.State()
	}
	writeJSON(w, d.Log, http.StatusOK, map[string]any{"items": views})
}
func (d Deps) handlePublishClassified(w http.ResponseWriter, r *http.Request) {
	actor, err := d.actorFrom(r)
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	listing, err := d.PublishClassified.Execute(r.Context(), actor, shared.ClassifiedID(r.PathValue("id")))
	if err != nil {
		writeProblem(w, d.Log, err)
		return
	}
	writeJSON(w, d.Log, http.StatusOK, listing.State())
}
