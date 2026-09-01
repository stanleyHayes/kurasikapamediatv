package testing

import (
	"context"
	"time"

	"github.com/kurasikapa/api/internal/app/ports"
	"github.com/kurasikapa/api/internal/domain/revenue"
	"github.com/kurasikapa/api/internal/domain/shared"
)

type ProductStore struct {
	Items map[shared.ProductID]revenue.Product
}

func NewProductStore() *ProductStore {
	return &ProductStore{Items: map[shared.ProductID]revenue.Product{}}
}
func (s *ProductStore) FindByID(_ context.Context, id shared.ProductID) (revenue.Product, error) {
	value, ok := s.Items[id]
	if !ok {
		return revenue.Product{}, ports.ErrNotFound
	}
	return value, nil
}
func (s *ProductStore) ListActive(context.Context, int) ([]revenue.Product, error) {
	out := []revenue.Product{}
	for _, value := range s.Items {
		if value.State().Active {
			out = append(out, value)
		}
	}
	return out, nil
}
func (s *ProductStore) ListAll(context.Context, int) ([]revenue.Product, error) {
	out := make([]revenue.Product, 0, len(s.Items))
	for _, value := range s.Items {
		out = append(out, value)
	}
	return out, nil
}
func (s *ProductStore) Save(_ context.Context, value revenue.Product) error {
	s.Items[value.ID()] = value
	return nil
}

type ProductOrderStore struct {
	Items map[shared.ProductOrderID]revenue.ProductOrder
}

func NewProductOrderStore() *ProductOrderStore {
	return &ProductOrderStore{Items: map[shared.ProductOrderID]revenue.ProductOrder{}}
}
func (s *ProductOrderStore) FindByID(_ context.Context, id shared.ProductOrderID) (revenue.ProductOrder, error) {
	value, ok := s.Items[id]
	if !ok {
		return revenue.ProductOrder{}, ports.ErrNotFound
	}
	return value, nil
}
func (s *ProductOrderStore) Save(_ context.Context, value revenue.ProductOrder) error {
	s.Items[value.ID()] = value
	return nil
}

type ClassifiedStore struct {
	Items map[shared.ClassifiedID]revenue.Classified
}

func NewClassifiedStore() *ClassifiedStore {
	return &ClassifiedStore{Items: map[shared.ClassifiedID]revenue.Classified{}}
}
func (s *ClassifiedStore) FindByID(_ context.Context, id shared.ClassifiedID) (revenue.Classified, error) {
	value, ok := s.Items[id]
	if !ok {
		return revenue.Classified{}, ports.ErrNotFound
	}
	return value, nil
}
func (s *ClassifiedStore) ListPublished(_ context.Context, at time.Time, _ int) ([]revenue.Classified, error) {
	out := []revenue.Classified{}
	for _, value := range s.Items {
		state := value.State()
		if state.Status == revenue.ClassifiedPublished && state.ExpiresAt != nil && state.ExpiresAt.After(at) {
			out = append(out, value)
		}
	}
	return out, nil
}
func (s *ClassifiedStore) ListAll(context.Context, int) ([]revenue.Classified, error) {
	out := make([]revenue.Classified, 0, len(s.Items))
	for _, value := range s.Items {
		out = append(out, value)
	}
	return out, nil
}
func (s *ClassifiedStore) Save(_ context.Context, value revenue.Classified) error {
	s.Items[value.ID()] = value
	return nil
}
