function Cart({ cart }) {
  const total = cart.reduce((sum, p) => sum + p.price, 0);

  const message = encodeURIComponent(
    cart.map(p => `- ${p.name}: $${p.price}`).join("\n") +
    `\n\nTotal: $${total}`
  );

  const phone = "573001234567"; // Cambia por tu número de WhatsApp

  if (cart.length === 0) {
    return (
      <div className="mt-8 p-6 bg-white rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-xl font-semibold mb-4 text-gray-800">
          Carrito vacío
        </h3>
        <p className="text-gray-600">
          Agrega productos para verlos aquí
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 p-6 bg-white rounded-lg shadow-sm border border-gray-100">
      <h3 className="text-xl font-semibold mb-4 text-gray-800">
        Carrito
      </h3>
      <ul className="space-y-2 mb-4">
        {cart.map((p, i) => (
          <li 
            key={i}
            className="flex justify-between items-center py-2 border-b border-gray-100 text-gray-600"
          >
            <span>{p.name}</span>
            <span className="text-blue-600">${p.price}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between items-center mb-4 py-2 border-t border-gray-100 text-gray-600">
        <span className="font-semibold">Total:</span>
        <span className="font-bold text-lg text-blue-600">
          ${total}
        </span>
      </div>
      <a
        href={`https://wa.me/${phone}?text=${message}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center"
      >
        <button
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-300"
        >
          Enviar pedido por WhatsApp
        </button>
      </a>
    </div>
  );
}

export default Cart;
  