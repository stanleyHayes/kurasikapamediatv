package revenue_test

import (
	"context"
	"testing"

	apprevenue "github.com/kurasikapa/api/internal/app/revenue"
	fakes "github.com/kurasikapa/api/internal/app/testing"
	domainrevenue "github.com/kurasikapa/api/internal/domain/revenue"
)

func commerceDeps() (apprevenue.Deps, *fakes.ProductStore, *fakes.ProductOrderStore, *fakes.ClassifiedStore, *gateway) {
	products, orders, classifieds, payment := fakes.NewProductStore(), fakes.NewProductOrderStore(), fakes.NewClassifiedStore(), &gateway{}
	return apprevenue.Deps{Products: products, ProductOrders: orders, Classifieds: classifieds, Payments: payment, Clock: fixedClock{}, IDs: &ids{}}, products, orders, classifieds, payment
}

func TestProductLifecycleAndCheckout(t *testing.T) {
	d, products, orders, _, payment := commerceDeps()
	product, err := apprevenue.NewCreateProduct(d).Execute(context.Background(), admin(), domainrevenue.ProductState{Name: "Annual", Slug: "annual", SKU: "ANN-01", Description: "The Kurasikapa year in review.", ImageURL: "https://cdn.test/annual.jpg", ImageAlt: "Annual cover", Price: domainrevenue.Money{Minor: 2000, Currency: domainrevenue.CurrencyEUR}, Stock: 8})
	if err != nil {
		t.Fatal(err)
	}
	product, err = apprevenue.NewActivateProduct(d).Execute(context.Background(), admin(), product.ID())
	if err != nil || !product.State().Active {
		t.Fatal(err)
	}
	result, err := apprevenue.NewStartProductOrder(d).Execute(context.Background(), apprevenue.StartProductOrderInput{ProductID: product.ID(), Quantity: 2, Email: "buyer@example.com", DeliveryName: "Ada Buyer", DeliveryAddress: "4 Rue des Lys, France", ReturnURL: "https://site.test/shop"})
	if err != nil || len(orders.Items) != 1 || payment.requests[0].Amount.Minor != 4000 {
		t.Fatalf("checkout failed: %v %+v", err, result)
	}
	order, err := apprevenue.NewConfirmProductOrder(d).Execute(context.Background(), "id_2", "paid_1")
	if err != nil || order.State().Status != domainrevenue.PaymentSucceeded {
		t.Fatal(err)
	}
	public, err := apprevenue.NewListProducts(d).Execute(context.Background(), nil)
	if err != nil || len(public) != 1 || len(products.Items) != 1 {
		t.Fatal(err)
	}
}

func TestPaidClassifiedRequiresManagerPublication(t *testing.T) {
	d, _, _, classifieds, payment := commerceDeps()
	result, err := apprevenue.NewSubmitClassified(d).Execute(context.Background(), apprevenue.SubmitClassifiedInput{Title: "Broadcast camera", Category: "Equipment", Description: "A professionally maintained broadcast camera.", Location: "Accra", ContactName: "Ama", ContactEmail: "ama@example.com", AskingPrice: domainrevenue.Money{Minor: 450000, Currency: domainrevenue.CurrencyGHS}, ReturnURL: "https://site.test/classifieds"})
	if err != nil || payment.requests[0].Amount.Minor != 5000 {
		t.Fatalf("submit failed: %v %+v", err, result)
	}
	listing, err := apprevenue.NewConfirmClassified(d).Execute(context.Background(), "id_1", "paid_2")
	if err != nil || listing.State().Status != domainrevenue.ClassifiedAwaitingReview {
		t.Fatal(err)
	}
	listing, err = apprevenue.NewPublishClassified(d).Execute(context.Background(), admin(), listing.ID())
	if err != nil || listing.State().Status != domainrevenue.ClassifiedPublished {
		t.Fatal(err)
	}
	rows, err := apprevenue.NewListClassifieds(d).Execute(context.Background(), nil)
	if err != nil || len(rows) != 1 || len(classifieds.Items) != 1 {
		t.Fatal(err)
	}
}

func TestCommerceRejectsUnavailableInventoryAndUnsupportedCurrency(t *testing.T) {
	d, products, _, _, _ := commerceDeps()
	products.Items["draft"] = domainrevenue.ReconstituteProduct(domainrevenue.ProductState{ID: "draft", Price: domainrevenue.Money{Minor: 100, Currency: domainrevenue.CurrencyGHS}, Stock: 1})
	if _, err := apprevenue.NewStartProductOrder(d).Execute(context.Background(), apprevenue.StartProductOrderInput{ProductID: "draft", Quantity: 1}); err == nil {
		t.Fatal("draft product accepted")
	}
	_, err := apprevenue.NewSubmitClassified(d).Execute(context.Background(), apprevenue.SubmitClassifiedInput{AskingPrice: domainrevenue.Money{Minor: 100, Currency: "USD"}})
	if err == nil {
		t.Fatal("unsupported fee currency accepted")
	}
}
