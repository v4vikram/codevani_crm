/**
 * Column detection for imported CSVs. Deliberately loose so an Apify export, a
 * RERA download and a hand-made sheet all work without configuration.
 */

const COLUMNS: Record<string, string[]> = {
  name: ["title", "name", "businessname", "companyname", "promotername", "displayname"],
  website: ["website", "websiteuri", "webaddress", "site", "socialorlistingurl"],
  phone: ["phone", "phoneunformatted", "phonenumber", "mobile", "contact",
          "contactnumber", "nationalphonenumber", "telephone"],
  rating: ["totalscore", "rating", "stars", "averagerating"],
  reviews: ["reviewscount", "reviews", "userratingcount", "numberofreviews", "reviewcount"],
  address: ["address", "fulladdress", "street", "registeredaddress"],
  area: ["neighborhood", "area", "locality", "city", "district", "town"],
  category: ["categoryname", "category", "type", "primarytype", "primarytypedisplayname", "categories/0"],
  mapsUrl: ["url", "mapsurl", "googlemapsuri", "link", "placeurl"],
  closed: ["permanentlyclosed", "temporarilyclosed", "businessstatus"],
  keyword: ["searchstring", "keyword", "searchterm", "query"],
};

const norm = (s: string) => String(s).toLowerCase().replace(/[\s_-]/g, "");

/** Maps our field names to whichever header this particular CSV uses. */
export function detectColumns(headers: string[]): Record<string, string> {
  const lookup = new Map(headers.map((h) => [norm(h), h]));
  const found: Record<string, string> = {};

  for (const [field, candidates] of Object.entries(COLUMNS)) {
    for (const c of candidates) {
      const hit = lookup.get(c);
      if (hit !== undefined) {
        found[field] = hit;
        break;
      }
    }
  }

  // `url` is Apify's Maps link, but on a plainer sheet it may mean the website.
  if (found.website && found.website === found.mapsUrl) {
    if (norm(found.website) === "url") delete found.website;
    else delete found.mapsUrl;
  }
  return found;
}

export function isClosed(value: unknown): boolean {
  const v = norm(String(value ?? ""));
  return v === "true" || v === "yes" || v.includes("closed");
}
