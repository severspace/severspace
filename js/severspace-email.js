/**
 * Envío de pedidos con EmailJS (solo frontend).
 * Requiere: script CDN + emailjs.init() + este archivo cargado después de severspace-data.js
 */

function severInitEmailJs() {
  if (typeof emailjs === "undefined") {
    console.error("EmailJS: no se cargó el script CDN.");
    return false;
  }
  emailjs.init({ publicKey: SEVER_EMAILJS_PUBLIC_KEY });
  return true;
}

function severEmailJsConfigured() {
  const placeholders = ["TU_PUBLIC_KEY", "TU_SERVICE_ID", "TU_TEMPLATE_ADMIN", "TU_TEMPLATE_CLIENT"];
  return (
    SEVER_EMAILJS_PUBLIC_KEY &&
    SEVER_EMAILJS_SERVICE_ID &&
    SEVER_EMAILJS_TEMPLATE_ADMIN &&
    SEVER_EMAILJS_TEMPLATE_CLIENT &&
    !placeholders.includes(SEVER_EMAILJS_PUBLIC_KEY) &&
    !placeholders.includes(SEVER_EMAILJS_SERVICE_ID) &&
    !placeholders.includes(SEVER_EMAILJS_TEMPLATE_ADMIN) &&
    !placeholders.includes(SEVER_EMAILJS_TEMPLATE_CLIENT)
  );
}

function severParseEmailJsError(err) {
  if (!err) return "Error desconocido al enviar el correo.";
  if (typeof err === "string") return err;
  const parts = [err.text, err.message, err.status && `Código ${err.status}`].filter(Boolean);
  return parts.join(" — ") || "Error de EmailJS. Revisá la consola (F12).";
}

function severBuildEmailParams(customer, orderNumber, cart) {
  const items = Object.values(cart).filter(item => item.quantity > 0 && SEVER_PRODUCTS[item.id]);
  const subtotal = severGetSubtotal(cart);
  const envio = severGetShippingAmount(subtotal);
  const total = severGetOrderTotal(cart);
  const freeShipping = severIsFreeShipping(subtotal);

  const direccionParts = [
    customer.address,
    customer.apartment ? `Apto ${customer.apartment}` : "",
    customer.city,
    customer.department,
    customer.postal ? `CP ${customer.postal}` : ""
  ].filter(Boolean);

  const productos = items
    .map(item => {
      const p = SEVER_PRODUCTS[item.id];
      const line = p.price * item.quantity;
      return `${p.name} · Talle ${item.size || "M"} · x${item.quantity} · ${severFormatPrice(line)}`;
    })
    .join("\n");

  const direccion = direccionParts.join(", ");

  return {
    nombre: customer.fullName,
    name: customer.fullName,
    email: customer.email,
    user_email: customer.email,
    telefono: customer.phone,
    phone: customer.phone,
    direccion,
    address: direccion,
    productos: productos || "(sin productos)",
    products: productos || "(sin productos)",
    total: severFormatPrice(total),
    metodoPago: customer.paymentMethod,
    metodo_pago: customer.paymentMethod,
    comentarios: customer.comments || "(ninguno)",
    comments: customer.comments || "(ninguno)",
    numero_pedido: orderNumber,
    order_id: orderNumber,
    subtotal: severFormatPrice(subtotal),
    envio: freeShipping ? "Gratis" : severFormatPrice(envio),
    from_name: customer.fullName,
    reply_to: customer.email
  };
}

async function severSendOneEmail(templateId, templateParams) {
  return emailjs.send(
    SEVER_EMAILJS_SERVICE_ID,
    templateId,
    templateParams,
    { publicKey: SEVER_EMAILJS_PUBLIC_KEY }
  );
}

async function severSendOrderEmails(customer, orderNumber, cart) {
  if (window.location.protocol === "file:") {
    throw new Error(
      "Abrí la tienda con Live Server (http://localhost), no como archivo file://. EmailJS no funciona bien desde file://."
    );
  }

  if (typeof emailjs === "undefined") {
    throw new Error("EmailJS no cargó. Revisá tu internet y el script en checkout.html.");
  }

  if (!severEmailJsConfigured()) {
    throw new Error("Configurá EmailJS en js/severspace-data.js (Public Key, Service ID y Template IDs).");
  }

  severInitEmailJs();

  const baseParams = severBuildEmailParams(customer, orderNumber, cart);

  try {
    await severSendOneEmail(SEVER_EMAILJS_TEMPLATE_ADMIN, {
      ...baseParams,
      to_email: SEVER_STORE_EMAIL,
      to_name: "Sever Space"
    });
  } catch (err) {
    throw new Error(`Email tienda (admin): ${severParseEmailJsError(err)}`);
  }

  try {
    await severSendOneEmail(SEVER_EMAILJS_TEMPLATE_CLIENT, {
      ...baseParams,
      to_email: customer.email,
      to_name: customer.fullName
    });
  } catch (err) {
    throw new Error(`Email cliente: ${severParseEmailJsError(err)}`);
  }
}
