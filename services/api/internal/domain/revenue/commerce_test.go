package revenue_test

import (
	"errors"
	"testing"
	"time"

	"github.com/kurasikapa/api/internal/domain/identity"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

func TestProductRequiresRevenueManagerAndStock(t *testing.T) {
	state := revenue.ProductState{ID: "product-1", Name: "Kurasikapa Annual", Slug: "annual", SKU: "ANNUAL-01", Description: "A printed year in review.", ImageURL: "https://cdn.example/annual.jpg", ImageAlt: "Annual cover", Price: revenue.Money{Minor: 25000, Currency: revenue.CurrencyGHS}, Stock: 20}
	if _, err := revenue.NewProduct(identity.NewActor("guest", []identity.Role{identity.RoleGuest}), state); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatalf("expected permission error, got %v", err)
	}
	product, err := revenue.NewProduct(commerceManager(), state)
	if err != nil {
		t.Fatal(err)
	}
	active, err := product.Activate(commerceManager(), time.Now())
	if err != nil || !active.State().Active {
		t.Fatalf("activation failed: %v", err)
	}
}

func TestProductOrderConfirmsOnce(t *testing.T) {
	order, err := revenue.StartProductOrder(revenue.ProductOrderState{ID: "order-1", ProductID: "product-1", Quantity: 2, Total: revenue.Money{Minor: 50000, Currency: revenue.CurrencyGHS}, Email: "reader@example.com", DeliveryName: "Ama Mensah", DeliveryAddress: "Accra", Provider: revenue.ProviderPaystack, ProviderRef: "checkout-1"}, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	order, err = order.Confirm("payment-1", time.Now())
	if err != nil || order.State().Status != revenue.PaymentSucceeded {
		t.Fatalf("confirm failed: %v", err)
	}
	if _, err = order.Confirm("payment-2", time.Now()); !errors.Is(err, revenue.ErrPaymentAlreadyFinal) {
		t.Fatalf("expected final error, got %v", err)
	}
}

func TestClassifiedNeedsPaymentAndReview(t *testing.T) {
	now := time.Now()
	listing, err := revenue.StartClassified(revenue.ClassifiedState{ID: "classified-1", Title: "Broadcast camera", Category: "Equipment", Description: "Professionally maintained camera.", Location: "Accra", ContactName: "Kofi", ContactEmail: "kofi@example.com", AskingPrice: revenue.Money{Minor: 400000, Currency: revenue.CurrencyGHS}, PlacementFee: revenue.Money{Minor: 5000, Currency: revenue.CurrencyGHS}, Provider: revenue.ProviderPaystack, ProviderRef: "checkout-2"}, now)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = listing.Publish(commerceManager(), now); err == nil {
		t.Fatal("unpaid listing published")
	}
	listing, err = listing.ConfirmPayment("payment-2", now)
	if err != nil {
		t.Fatal(err)
	}
	listing, err = listing.Publish(commerceManager(), now)
	if err != nil || listing.State().Status != revenue.ClassifiedPublished {
		t.Fatalf("publish failed: %v", err)
	}
	if listing.State().ExpiresAt == nil || listing.State().ExpiresAt.Sub(now) != 30*24*time.Hour {
		t.Fatal("expected 30 day placement")
	}
}

func TestCommerceValidationAndReconstitution(t *testing.T) {
	product := revenue.ProductState{ID: "p", Name: "Name", Slug: "name", SKU: "SKU", Description: "Description", ImageURL: "https://cdn.test/p.jpg", ImageAlt: "Product image", Price: revenue.Money{Minor: 100, Currency: revenue.CurrencyGHS}, Stock: 1}
	invalidProducts := []revenue.ProductState{{}, withProduct(product, func(s *revenue.ProductState) { s.Name = "" }), withProduct(product, func(s *revenue.ProductState) { s.ImageURL = "http://unsafe" }), withProduct(product, func(s *revenue.ProductState) { s.Price.Minor = 0 }), withProduct(product, func(s *revenue.ProductState) { s.Stock = -1 })}
	for _, state := range invalidProducts {
		if _, err := revenue.NewProduct(commerceManager(), state); err == nil {
			t.Fatalf("invalid product accepted: %+v", state)
		}
	}
	rebuilt := revenue.ReconstituteProduct(product)
	if rebuilt.ID() != "p" {
		t.Fatal("product id lost")
	}
	zeroStock := product
	zeroStock.Stock = 0
	if _, err := revenue.ReconstituteProduct(zeroStock).Activate(commerceManager(), time.Now()); err == nil {
		t.Fatal("empty stock activated")
	}
	if _, err := rebuilt.Activate(identity.NewActor("guest", []identity.Role{identity.RoleGuest}), time.Now()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}

	order := revenue.ProductOrderState{ID: "o", ProductID: "p", Quantity: 1, Total: product.Price, Email: "a@b.com", DeliveryName: "A", DeliveryAddress: "Accra", Provider: revenue.ProviderPaystack, ProviderRef: "ref"}
	for _, mutate := range []func(*revenue.ProductOrderState){func(s *revenue.ProductOrderState) { s.ID = "" }, func(s *revenue.ProductOrderState) { s.Quantity = 0 }, func(s *revenue.ProductOrderState) { s.Total.Minor = 0 }, func(s *revenue.ProductOrderState) { s.ProviderRef = "" }, func(s *revenue.ProductOrderState) { s.Email = "" }} {
		state := order
		mutate(&state)
		if _, err := revenue.StartProductOrder(state, time.Now()); err == nil {
			t.Fatal("invalid order accepted")
		}
	}
	rebuiltOrder := revenue.ReconstituteProductOrder(order)
	if rebuiltOrder.ID() != "o" {
		t.Fatal("order id lost")
	}
	if _, err := rebuiltOrder.Confirm("", time.Now()); err == nil {
		t.Fatal("blank payment accepted")
	}

	classified := revenue.ClassifiedState{ID: "c", Title: "Title", Category: "Category", Description: "Description", Location: "Accra", ContactName: "Ama", ContactEmail: "a@b.com", AskingPrice: product.Price, PlacementFee: product.Price, Provider: revenue.ProviderPaystack, ProviderRef: "ref"}
	for _, mutate := range []func(*revenue.ClassifiedState){func(s *revenue.ClassifiedState) { s.ID = "" }, func(s *revenue.ClassifiedState) { s.Title = "" }, func(s *revenue.ClassifiedState) { s.AskingPrice.Minor = 0 }, func(s *revenue.ClassifiedState) { s.PlacementFee.Minor = 0 }, func(s *revenue.ClassifiedState) { s.ProviderRef = "" }} {
		state := classified
		mutate(&state)
		if _, err := revenue.StartClassified(state, time.Now()); err == nil {
			t.Fatal("invalid classified accepted")
		}
	}
	rebuiltClassified := revenue.ReconstituteClassified(classified)
	if rebuiltClassified.ID() != "c" {
		t.Fatal("classified id lost")
	}
	if _, err := rebuiltClassified.ConfirmPayment("", time.Now()); err == nil {
		t.Fatal("blank payment accepted")
	}
	if _, err := rebuiltClassified.Publish(identity.NewActor("guest", []identity.Role{identity.RoleGuest}), time.Now()); !errors.Is(err, identity.ErrNotPermitted) {
		t.Fatal(err)
	}
}

func withProduct(value revenue.ProductState, mutate func(*revenue.ProductState)) revenue.ProductState {
	mutate(&value)
	return value
}

func commerceManager() identity.Actor {
	return identity.NewActor(shared.UserID("admin"), []identity.Role{identity.RoleAdministrator})
}
