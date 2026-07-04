import ProductLines from '../components/ProductLines';

export default function ManageProducts() {
  return (
    <div>
      <h2>Products</h2>
      <p className="tooltip-hint" style={{ marginBottom: 16 }}>
        Service Line › Department › Product hierarchy used throughout revenue and expense reporting. Add a new
        product here, including which GL account it should default to.
      </p>
      <ProductLines />
    </div>
  );
}
