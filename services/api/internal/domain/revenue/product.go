package revenue

import (
	"errors"
	"strings"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/shared"
)

var (
	ErrProductIdentity = errors.New("product requires a name, slug and sku")
	ErrProductCopy     = errors.New("product requires a description and https image")
	ErrInvalidStock    = errors.New("product stock cannot be negative")
)

type ProductState struct {
	ID                                               shared.ProductID `json:"id"`
	Name, Slug, SKU, Description, ImageURL, ImageAlt string
	Price                                            Money         `json:"price"`
	Stock                                            int           `json:"stock"`
	Active                                           bool          `json:"active"`
	ActivatedAt                                      *time.Time    `json:"activatedAt"`
	CreatedBy                                        shared.UserID `json:"createdBy"`
}

type Product struct{ state ProductState }

func NewProduct(actor identity.Actor, state ProductState) (Product, error) {
	if err := actor.Require(identity.PermRevenueManage); err != nil {
		return Product{}, err
	}
	state.Name, state.Slug, state.SKU = trim3(state.Name, state.Slug, state.SKU)
	state.Description, state.ImageURL, state.ImageAlt = trim3(state.Description, state.ImageURL, state.ImageAlt)
	if state.ID == "" {
		return Product{}, shared.ErrEmptyID
	}
	if state.Name == "" || state.Slug == "" || state.SKU == "" {
		return Product{}, ErrProductIdentity
	}
	if state.Description == "" || state.ImageAlt == "" || !strings.HasPrefix(state.ImageURL, "https://") {
		return Product{}, ErrProductCopy
	}
	if err := validateMoney(state.Price); err != nil {
		return Product{}, err
	}
	if state.Stock < 0 {
		return Product{}, ErrInvalidStock
	}
	state.Active, state.ActivatedAt, state.CreatedBy = false, nil, actor.ID()
	return Product{state: state}, nil
}

func ReconstituteProduct(state ProductState) Product { return Product{state: state} }
func (p Product) ID() shared.ProductID               { return p.state.ID }
func (p Product) State() ProductState                { return p.state }
func (p Product) Activate(actor identity.Actor, at time.Time) (Product, error) {
	if err := actor.Require(identity.PermRevenueManage); err != nil {
		return Product{}, err
	}
	if p.state.Stock == 0 {
		return Product{}, ErrInvalidStock
	}
	p.state.Active, p.state.ActivatedAt = true, &at
	return p, nil
}
func trim3(a, b, c string) (string, string, string) {
	return strings.TrimSpace(a), strings.TrimSpace(b), strings.TrimSpace(c)
}
