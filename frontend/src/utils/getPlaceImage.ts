import { getCuratedFallbackPhoto } from "@/services/photoService";

export function getPlaceImage(place: {
  name: string;
  photo_reference?: string | null;
  image_url?: string | null;
  photo_url?: string | null;
  image?: string | null;
  type?: string;
  image_keyword?: string;
  english_name?: string;
}) {
  const directUrl = place.image_url || place.photo_url || place.image;
  if (directUrl && directUrl.startsWith("http")) {
    return directUrl;
  }
  if (place.photo_reference && place.photo_reference.startsWith("http")) {
    return place.photo_reference;
  }

  return getCuratedFallbackPhoto(place.type, place.image_keyword || place.english_name || place.name || "destination");
}

