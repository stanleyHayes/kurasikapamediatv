package revenue

import (
	"context"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/identity"
	domainrevenue "github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type CreateProduct struct{ deps Deps }

func NewCreateProduct(deps Deps) CreateProduct { return CreateProduct{deps: deps} }
func (u CreateProduct) Execute(ctx context.Context, actor identity.Actor, input domainrevenue.ProductState) (domainrevenue.Product, error) {
	input.ID = shared.ProductID(u.deps.IDs.NewID())
	product, err := domainrevenue.NewProduct(actor, input)
	if err != nil {
		return domainrevenue.Product{}, err
	}
	return product, u.deps.Products.Save(ctx, product)
}

type ActivateProduct struct{ deps Deps }

func NewActivateProduct(deps Deps) ActivateProduct { return ActivateProduct{deps: deps} }
func (u ActivateProduct) Execute(ctx context.Context, actor identity.Actor, id shared.ProductID) (domainrevenue.Product, error) {
	product, err := u.deps.Products.FindByID(ctx, id)
	if err != nil {
		return domainrevenue.Product{}, err
	}
	product, err = product.Activate(actor, u.deps.Clock.Now())
	if err != nil {
		return domainrevenue.Product{}, err
	}
	return product, u.deps.Products.Save(ctx, product)
}

type ListProducts struct{ deps Deps }

func NewListProducts(deps Deps) ListProducts { return ListProducts{deps: deps} }
func (u ListProducts) Execute(ctx context.Context, actor *identity.Actor) ([]domainrevenue.Product, error) {
	if actor == nil {
		return u.deps.Products.ListActive(ctx, 100)
	}
	if err := actor.Require(identity.PermRevenueRead); err != nil {
		return nil, err
	}
	return u.deps.Products.ListAll(ctx, 250)
}

type StartProductOrderInput struct {
	ProductID                                       shared.ProductID
	Quantity                                        int
	Email, DeliveryName, DeliveryAddress, ReturnURL string
}
type StartProductOrder struct{ deps Deps }

func NewStartProductOrder(deps Deps) StartProductOrder { return StartProductOrder{deps: deps} }
func (u StartProductOrder) Execute(ctx context.Context, input StartProductOrderInput) (CheckoutResult, error) {
	product, err := u.deps.Products.FindByID(ctx, input.ProductID)
	if err != nil {
		return CheckoutResult{}, err
	}
	state := product.State()
	if !state.Active || input.Quantity < 1 || input.Quantity > state.Stock {
		return CheckoutResult{}, domainrevenue.ErrInvalidQuantity
	}
	total := domainrevenue.Money{Minor: state.Price.Minor * int64(input.Quantity), Currency: state.Price.Currency}
	id := shared.ProductOrderID(u.deps.IDs.NewID())
	session, err := u.deps.Payments.StartCheckout(ctx, checkout(id.String(), "product", total, input.Email, input.ReturnURL))
	if err != nil {
		return CheckoutResult{}, err
	}
	order, err := domainrevenue.StartProductOrder(domainrevenue.ProductOrderState{ID: id, ProductID: product.ID(), Quantity: input.Quantity, Total: total, Email: input.Email, DeliveryName: input.DeliveryName, DeliveryAddress: input.DeliveryAddress, Provider: session.Provider, ProviderRef: session.ProviderRef}, u.deps.Clock.Now())
	if err != nil {
		return CheckoutResult{}, err
	}
	if err = u.deps.ProductOrders.Save(ctx, order); err != nil {
		return CheckoutResult{}, err
	}
	return CheckoutResult{ID: id.String(), Provider: session.Provider, CheckoutURL: session.CheckoutURL}, nil
}

type SubmitClassifiedInput struct {
	Title, Category, Description, Location, ContactName, ContactEmail, ContactPhone, ImageURL string
	AskingPrice                                                                               domainrevenue.Money
	ReturnURL                                                                                 string
}
type SubmitClassified struct{ deps Deps }

func NewSubmitClassified(deps Deps) SubmitClassified { return SubmitClassified{deps: deps} }
func (u SubmitClassified) Execute(ctx context.Context, input SubmitClassifiedInput) (CheckoutResult, error) {
	fee, err := classifiedFee(input.AskingPrice.Currency)
	if err != nil {
		return CheckoutResult{}, err
	}
	id := shared.ClassifiedID(u.deps.IDs.NewID())
	session, err := u.deps.Payments.StartCheckout(ctx, checkout(id.String(), "classified", fee, input.ContactEmail, input.ReturnURL))
	if err != nil {
		return CheckoutResult{}, err
	}
	listing, err := domainrevenue.StartClassified(domainrevenue.ClassifiedState{ID: id, Title: input.Title, Category: input.Category, Description: input.Description, Location: input.Location, ContactName: input.ContactName, ContactEmail: input.ContactEmail, ContactPhone: input.ContactPhone, ImageURL: input.ImageURL, AskingPrice: input.AskingPrice, PlacementFee: fee, Provider: session.Provider, ProviderRef: session.ProviderRef}, u.deps.Clock.Now())
	if err != nil {
		return CheckoutResult{}, err
	}
	if err = u.deps.Classifieds.Save(ctx, listing); err != nil {
		return CheckoutResult{}, err
	}
	return CheckoutResult{ID: id.String(), Provider: session.Provider, CheckoutURL: session.CheckoutURL}, nil
}

func checkout(reference, purpose string, amount domainrevenue.Money, email, returnURL string) ports.CheckoutRequest {
	return ports.CheckoutRequest{Reference: reference, Purpose: purpose, Amount: amount, Email: email, ReturnURL: returnURL}
}

func classifiedFee(currency domainrevenue.Currency) (domainrevenue.Money, error) {
	minor := int64(1000)
	if currency == domainrevenue.CurrencyGHS {
		minor = 5000
	}
	return domainrevenue.NewMoney(minor, currency)
}

type ConfirmProductOrder struct{ deps Deps }

func NewConfirmProductOrder(deps Deps) ConfirmProductOrder { return ConfirmProductOrder{deps: deps} }
func (u ConfirmProductOrder) Execute(ctx context.Context, id shared.ProductOrderID, ref string) (domainrevenue.ProductOrder, error) {
	order, err := u.deps.ProductOrders.FindByID(ctx, id)
	if err != nil {
		return domainrevenue.ProductOrder{}, err
	}
	if order.State().Status == domainrevenue.PaymentSucceeded && order.State().PaymentRef == ref {
		return order, nil
	}
	order, err = order.Confirm(ref, u.deps.Clock.Now())
	if err != nil {
		return domainrevenue.ProductOrder{}, err
	}
	return order, u.deps.ProductOrders.Save(ctx, order)
}

type ConfirmClassified struct{ deps Deps }

func NewConfirmClassified(deps Deps) ConfirmClassified { return ConfirmClassified{deps: deps} }
func (u ConfirmClassified) Execute(ctx context.Context, id shared.ClassifiedID, ref string) (domainrevenue.Classified, error) {
	listing, err := u.deps.Classifieds.FindByID(ctx, id)
	if err != nil {
		return domainrevenue.Classified{}, err
	}
	if listing.State().Status == domainrevenue.ClassifiedAwaitingReview && listing.State().PaymentRef == ref {
		return listing, nil
	}
	listing, err = listing.ConfirmPayment(ref, u.deps.Clock.Now())
	if err != nil {
		return domainrevenue.Classified{}, err
	}
	return listing, u.deps.Classifieds.Save(ctx, listing)
}

type PublishClassified struct{ deps Deps }

func NewPublishClassified(deps Deps) PublishClassified { return PublishClassified{deps: deps} }
func (u PublishClassified) Execute(ctx context.Context, actor identity.Actor, id shared.ClassifiedID) (domainrevenue.Classified, error) {
	listing, err := u.deps.Classifieds.FindByID(ctx, id)
	if err != nil {
		return domainrevenue.Classified{}, err
	}
	listing, err = listing.Publish(actor, u.deps.Clock.Now())
	if err != nil {
		return domainrevenue.Classified{}, err
	}
	return listing, u.deps.Classifieds.Save(ctx, listing)
}

type ListClassifieds struct{ deps Deps }

func NewListClassifieds(deps Deps) ListClassifieds { return ListClassifieds{deps: deps} }
func (u ListClassifieds) Execute(ctx context.Context, actor *identity.Actor) ([]domainrevenue.Classified, error) {
	if actor == nil {
		return u.deps.Classifieds.ListPublished(ctx, u.deps.Clock.Now(), 100)
	}
	if err := actor.Require(identity.PermRevenueRead); err != nil {
		return nil, err
	}
	return u.deps.Classifieds.ListAll(ctx, 250)
}
