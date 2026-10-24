export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET - Find competitors using Google Places API
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    const sector = searchParams.get("sector");
    const radiusKm = parseInt(searchParams.get("radius") || "5");

    if (!address) {
        return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        return NextResponse.json(
            { error: "Google Maps API key not configured" },
            { status: 500 }
        );
    }

    try {
        // Step 1: Geocode the address to get lat/lng
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            address
        )}&key=${apiKey}`;

        const geocodeRes = await fetch(geocodeUrl);
        const geocodeData = await geocodeRes.json() as any;

        if (geocodeData.status !== "OK" || !geocodeData.results[0]) {
            return NextResponse.json(
                { error: "Could not geocode address", details: geocodeData.status },
                { status: 400 }
            );
        }

        const location = geocodeData.results[0].geometry.location;
        const { lat, lng } = location;

        // Step 2: Search for nearby places using sector keyword
        const radiusMeters = radiusKm * 1000;
        const keyword = sector || "business";

        const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&keyword=${encodeURIComponent(
            keyword
        )}&key=${apiKey}`;

        const nearbyRes = await fetch(nearbyUrl);
        const nearbyData = await nearbyRes.json() as any;

        if (nearbyData.status !== "OK" && nearbyData.status !== "ZERO_RESULTS") {
            return NextResponse.json(
                { error: "Places API error", details: nearbyData.status },
                { status: 500 }
            );
        }

        // Step 3: Process competitors
        const competitors = await Promise.all(
            (nearbyData.results || []).slice(0, 12).map(async (place: any) => {
                // Calculate distance
                const distanceKm = calculateDistance(
                    lat,
                    lng,
                    place.geometry.location.lat,
                    place.geometry.location.lng
                );

                // Get place details for more info
                let website = null;
                let phoneNumber = null;
                let socialUrls: { instagram: string | null; facebook: string | null } = { instagram: null, facebook: null };

                try {
                    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=website,formatted_phone_number&key=${apiKey}`;
                    const detailsRes = await fetch(detailsUrl);
                    const detailsData = await detailsRes.json() as any;

                    if (detailsData.status === "OK" && detailsData.result) {
                        website = detailsData.result.website || null;
                        phoneNumber = detailsData.result.formatted_phone_number || null;

                        // Try to extract social URLs from website (basic heuristic)
                        if (website) {
                            // This would need more sophisticated scraping in production
                            socialUrls = await extractSocialUrls(website);
                        }
                    }
                } catch (err) {
                    console.error("Error fetching place details:", err);
                }

                return {
                    id: `comp_${place.place_id}`,
                    place_id: place.place_id,
                    name: place.name,
                    address: place.vicinity || place.formatted_address,
                    distance_km: distanceKm,
                    rating: place.rating || null,
                    review_count: place.user_ratings_total || 0,
                    types: place.types || [],
                    google_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
                    website,
                    phone_number: phoneNumber,
                    instagram_url: socialUrls.instagram,
                    facebook_url: socialUrls.facebook,
                    location: {
                        lat: place.geometry.location.lat,
                        lng: place.geometry.location.lng,
                    },
                };
            })
        );

        // Sort by distance
        competitors.sort((a: any, b: any) => a.distance_km - b.distance_km);

        return NextResponse.json({
            success: true,
            client_location: { lat, lng, address },
            competitors,
            total_found: competitors.length,
            search_radius_km: radiusKm,
        });
    } catch (error) {
        console.error("Geo-Agent error:", error);
        return NextResponse.json(
            { error: "Failed to find competitors", details: String(error) },
            { status: 500 }
        );
    }
}

// Helper: Calculate distance between two lat/lng points (Haversine formula)
function calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
}

function toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
}

// Helper: Extract social URLs from website (basic version)
async function extractSocialUrls(
    _websiteUrl: string
): Promise<{ instagram: string | null; facebook: string | null }> {
    // In production, this would scrape the website
    // For now, return null - will be implemented in Web-Agent
    return { instagram: null, facebook: null };
}
