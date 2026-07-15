import { inventoryVehicles } from '../data/inventory';
import { InventoryVehicle, Lead } from '../types';

const STOPWORDS = new Set(['de', 'do', 'da', 'e', 'o', 'a', '10', '16', '20']);

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

/**
 * Casa um texto livre (mensagem do cliente ou campo `vehicle` do lead)
 * com um veículo do estoque. Pontua por tokens do modelo presentes no texto;
 * exige pelo menos um token forte (nome do modelo, ex: "argo", "onix").
 */
export function matchInventoryVehicle(text: string): InventoryVehicle | null {
  const textTokens = new Set(tokens(text));
  if (textTokens.size === 0) return null;

  let best: { vehicle: InventoryVehicle; score: number } | null = null;
  for (const vehicle of inventoryVehicles) {
    const modelTokens = tokens(vehicle.model);
    const score = modelTokens.filter((token) => textTokens.has(token)).length;
    if (score > 0 && (!best || score > best.score)) {
      best = { vehicle, score };
    }
  }
  return best ? best.vehicle : null;
}

/** Foto preferencial do estoque; cai para a imagem já registrada no lead. */
export function vehicleImageFor(lead: Lead): string {
  const stock = matchInventoryVehicle(lead.vehicle);
  return stock?.image || lead.vehicleImage;
}

/** Ficha resumida do veículo para a IA responder com dados reais, sem inventar. */
export function buildVehicleSheet(vehicle: InventoryVehicle): string {
  return [
    `Modelo: ${vehicle.model}`,
    `Ano: ${vehicle.year}`,
    `Preço: ${vehicle.price}`,
    `Km: ${vehicle.mileage}`,
    `Situação: ${vehicle.status}`,
    `Destaques: ${vehicle.highlights.join(', ')}`,
  ].join(' | ');
}

const PHOTO_PATTERNS = /\b(foto|fotos|imagem|imagens|me mostra|manda a?s? foto|ver o carro|quero ver)\b/i;

export function asksForPhoto(text: string): boolean {
  return PHOTO_PATTERNS.test(text);
}
