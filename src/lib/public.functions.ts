import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface PublicBox {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverUrl: string | null;
  description: string;
  story: string;
  city: string;
  state: string;
  region: string;
  whatsapp: string | null;
  createdAt: string;
  rating: number | null;
  reviewCount: number;
  productCount: number;
}

export interface PublicProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: "plantas" | "insumos" | "maquinas";
  subcategory: string;
  imageUrls: string[];
  createdAt: string;
  box: { id: string; name: string; slug: string; city: string; state: string; region: string };
}

export interface PublicReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  buyerName: string;
}

const searchSchema = z.object({
  q: z.string().trim().max(80).optional(),
  categoria: z.enum(["plantas", "insumos", "maquinas"]).optional(),
  sub: z.string().max(60).optional(),
  regiao: z.string().max(60).optional(),
  ordem: z.enum(["recentes", "menor", "maior"]).optional(),
  limit: z.number().int().min(1).max(60).optional(),
});

type ReviewRow = { box_id: string; rating: number };

function aggregateReviews(rows: ReviewRow[]) {
  const map = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const cur = map.get(r.box_id) ?? { sum: 0, n: 0 };
    cur.sum += r.rating;
    cur.n += 1;
    map.set(r.box_id, cur);
  }
  return map;
}

/** Home: boxes em destaque + produtos recentes por categoria. */
export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const { createPublicClient, signPaths, resolve } = await import("./supabase-public.server");
  const sb = createPublicClient();

  const [boxesRes, productsRes, reviewsRes] = await Promise.all([
    sb.from("boxes").select("*").order("created_at", { ascending: false }).limit(8),
    sb
      .from("products")
      .select("*, boxes!inner(id, name, slug, city, state, region)")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(24),
    sb.from("reviews").select("box_id, rating"),
  ]);

  const boxes = boxesRes.data ?? [];
  const products = productsRes.data ?? [];
  const agg = aggregateReviews((reviewsRes.data ?? []) as ReviewRow[]);

  const counts = new Map<string, number>();
  if (boxes.length) {
    const { data: pc } = await sb
      .from("products")
      .select("box_id")
      .eq("active", true)
      .in(
        "box_id",
        boxes.map((b) => b.id),
      );
    for (const row of pc ?? []) counts.set(row.box_id, (counts.get(row.box_id) ?? 0) + 1);
  }

  const urlMap = await signPaths(sb, [
    ...boxes.flatMap((b) => [b.logo_url, b.cover_url]),
    ...products.map((p) => p.images[0]),
  ]);

  const featuredBoxes: PublicBox[] = boxes.map((b) => {
    const a = agg.get(b.id);
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      logoUrl: resolve(urlMap, b.logo_url),
      coverUrl: resolve(urlMap, b.cover_url),
      description: b.description,
      story: b.story,
      city: b.city,
      state: b.state,
      region: b.region,
      whatsapp: b.whatsapp,
      createdAt: b.created_at,
      rating: a ? a.sum / a.n : null,
      reviewCount: a?.n ?? 0,
      productCount: counts.get(b.id) ?? 0,
    };
  });

  const recentProducts: PublicProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    stock: p.stock,
    category: p.category,
    subcategory: p.subcategory,
    imageUrls: p.images[0] ? [resolve(urlMap, p.images[0])].filter((x): x is string => !!x) : [],
    createdAt: p.created_at,
    box: p.boxes,
  }));

  return { featuredBoxes, recentProducts };
});

function mapProduct(
  p: {
    id: string; name: string; description: string; price: number | string; stock: number;
    category: "plantas" | "insumos" | "maquinas"; subcategory: string; images: string[]; created_at: string;
    boxes: PublicProduct["box"];
  },
  urlMap: Map<string, string>,
  resolve: (m: Map<string, string>, k: string | null | undefined) => string | null,
): PublicProduct {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    stock: p.stock,
    category: p.category,
    subcategory: p.subcategory,
    imageUrls: p.images[0] ? [resolve(urlMap, p.images[0])].filter((x): x is string => !!x) : [],
    createdAt: p.created_at,
    box: p.boxes,
  };
}

/** Busca de produtos e boxes com filtros de categoria, subcategoria e região. */
export const searchProducts = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => searchSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { createPublicClient, signPaths, resolve } = await import("./supabase-public.server");
    const { NEARBY_REGIONS } = await import("./categories");
    const sb = createPublicClient();
    const limit = data.limit ?? 48;

    const buildProducts = (regions: string[] | null, max: number) => {
      let query = sb
        .from("products")
        .select("*, boxes!inner(id, name, slug, city, state, region)")
        .eq("active", true)
        .limit(max);
      if (data.q) query = query.ilike("name", `%${data.q}%`);
      if (data.categoria) query = query.eq("category", data.categoria);
      if (data.sub) query = query.eq("subcategory", data.sub);
      if (regions) query = query.in("boxes.region", regions);
      if (data.ordem === "menor") query = query.order("price", { ascending: true });
      else if (data.ordem === "maior") query = query.order("price", { ascending: false });
      else query = query.order("created_at", { ascending: false });
      return query;
    };

    const nearbyRegions = data.regiao ? (NEARBY_REGIONS[data.regiao] ?? []) : [];

    // Boxes: filtra por região e (se houver) por categoria via produtos ativos
    let boxQuery = sb.from("boxes").select("*").order("created_at", { ascending: false }).limit(24);
    if (data.regiao) boxQuery = boxQuery.eq("region", data.regiao);
    if (data.q) boxQuery = boxQuery.or(`name.ilike.%${data.q}%,city.ilike.%${data.q}%`);

    const [mainRes, nearRes, boxRes, reviewsRes] = await Promise.all([
      buildProducts(data.regiao ? [data.regiao] : null, limit),
      nearbyRegions.length ? buildProducts(nearbyRegions, 12) : Promise.resolve({ data: [], error: null }),
      boxQuery,
      sb.from("reviews").select("box_id, rating"),
    ]);
    if (mainRes.error) throw new Error(mainRes.error.message);
    if (nearRes.error) throw new Error(nearRes.error.message);
    if (boxRes.error) throw new Error(boxRes.error.message);

    const mainRows = mainRes.data ?? [];
    const nearRows = nearRes.data ?? [];
    let boxRows = boxRes.data ?? [];

    // Contagem de produtos ativos por box (respeitando categoria/sub quando informados)
    let countQuery = sb.from("products").select("box_id, category, subcategory").eq("active", true);
    if (boxRows.length) countQuery = countQuery.in("box_id", boxRows.map((b) => b.id));
    if (data.categoria) countQuery = countQuery.eq("category", data.categoria);
    if (data.sub) countQuery = countQuery.eq("subcategory", data.sub);
    const { data: countRows } = await countQuery;
    const counts = new Map<string, number>();
    for (const r of countRows ?? []) counts.set(r.box_id, (counts.get(r.box_id) ?? 0) + 1);
    if (data.categoria || data.sub) boxRows = boxRows.filter((b) => (counts.get(b.id) ?? 0) > 0);

    const agg = aggregateReviews((reviewsRes.data ?? []) as ReviewRow[]);

    const urlMap = await signPaths(sb, [
      ...mainRows.map((p) => p.images[0]),
      ...nearRows.map((p) => p.images[0]),
      ...boxRows.map((b) => b.logo_url),
      ...boxRows.map((b) => b.cover_url),
    ]);

    const boxes: PublicBox[] = boxRows.map((b) => {
      const a = agg.get(b.id);
      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        logoUrl: resolve(urlMap, b.logo_url),
        coverUrl: resolve(urlMap, b.cover_url),
        description: b.description,
        story: b.story,
        city: b.city,
        state: b.state,
        region: b.region,
        whatsapp: b.whatsapp,
        createdAt: b.created_at,
        rating: a ? a.sum / a.n : null,
        reviewCount: a?.n ?? 0,
        productCount: counts.get(b.id) ?? 0,
      };
    });

    const mainIds = new Set(mainRows.map((p) => p.id));
    return {
      products: mainRows.map((p) => mapProduct(p, urlMap, resolve)),
      nearbyProducts: nearRows.filter((p) => !mainIds.has(p.id)).map((p) => mapProduct(p, urlMap, resolve)),
      nearbyRegions,
      boxes,
    };
  });

/** Página pública do box. */
export const getBoxBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => z.object({ slug: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const { createPublicClient, signPaths, resolve } = await import("./supabase-public.server");
    const sb = createPublicClient();

    const { data: b } = await sb.from("boxes").select("*").eq("slug", data.slug).maybeSingle();
    if (!b) return null;

    const [productsRes, reviewsRes] = await Promise.all([
      sb.from("products").select("*").eq("box_id", b.id).eq("active", true).order("created_at", { ascending: false }),
      sb.from("reviews").select("*").eq("box_id", b.id).order("created_at", { ascending: false }).limit(30),
    ]);

    const reviewsRaw = reviewsRes.data ?? [];
    const buyerIds = Array.from(new Set(reviewsRaw.map((r) => r.buyer_id)));
    const { data: profiles } = buyerIds.length
      ? await sb.from("profiles").select("id, full_name").in("id", buyerIds)
      : { data: [] as { id: string; full_name: string }[] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const productsRaw = productsRes.data ?? [];
    const urlMap = await signPaths(sb, [b.logo_url, b.cover_url, ...productsRaw.map((p) => p.images[0])]);

    const rating = reviewsRaw.length ? reviewsRaw.reduce((s, r) => s + r.rating, 0) / reviewsRaw.length : null;

    const box: PublicBox = {
      id: b.id,
      name: b.name,
      slug: b.slug,
      logoUrl: resolve(urlMap, b.logo_url),
      coverUrl: resolve(urlMap, b.cover_url),
      description: b.description,
      story: b.story,
      city: b.city,
      state: b.state,
      region: b.region,
      whatsapp: b.whatsapp,
      createdAt: b.created_at,
      rating,
      reviewCount: reviewsRaw.length,
      productCount: productsRaw.length,
    };

    const products: PublicProduct[] = productsRaw.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      stock: p.stock,
      category: p.category,
      subcategory: p.subcategory,
      imageUrls: p.images[0] ? [resolve(urlMap, p.images[0])].filter((x): x is string => !!x) : [],
      createdAt: p.created_at,
      box: { id: b.id, name: b.name, slug: b.slug, city: b.city, state: b.state, region: b.region },
    }));

    const reviews: PublicReview[] = reviewsRaw.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
      buyerName: nameMap.get(r.buyer_id) ?? "Comprador",
    }));

    return { box, products, reviews };
  });

/** Detalhe do produto. */
export const getProductById = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { createPublicClient, signPaths, resolve } = await import("./supabase-public.server");
    const sb = createPublicClient();

    const { data: p } = await sb
      .from("products")
      .select("*, boxes!inner(id, name, slug, city, state, region, logo_url, whatsapp)")
      .eq("id", data.id)
      .eq("active", true)
      .maybeSingle();
    if (!p) return null;

    const [{ data: reviews }, { data: related }] = await Promise.all([
      sb.from("reviews").select("rating").eq("box_id", p.box_id),
      sb
        .from("products")
        .select("*, boxes!inner(id, name, slug, city, state, region)")
        .eq("box_id", p.box_id)
        .eq("active", true)
        .neq("id", p.id)
        .limit(4),
    ]);

    const urlMap = await signPaths(sb, [...p.images, p.boxes.logo_url, ...(related ?? []).map((r) => r.images[0])]);

    const rating = reviews?.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

    const product: PublicProduct & { boxLogoUrl: string | null; boxWhatsapp: string | null; boxRating: number | null; boxReviewCount: number } = {
      id: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      stock: p.stock,
      category: p.category,
      subcategory: p.subcategory,
      imageUrls: p.images.map((i) => resolve(urlMap, i)).filter((x): x is string => !!x),
      createdAt: p.created_at,
      box: { id: p.boxes.id, name: p.boxes.name, slug: p.boxes.slug, city: p.boxes.city, state: p.boxes.state, region: p.boxes.region },
      boxLogoUrl: resolve(urlMap, p.boxes.logo_url),
      boxWhatsapp: p.boxes.whatsapp,
      boxRating: rating,
      boxReviewCount: reviews?.length ?? 0,
    };

    const relatedProducts: PublicProduct[] = (related ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      price: Number(r.price),
      stock: r.stock,
      category: r.category,
      subcategory: r.subcategory,
      imageUrls: r.images[0] ? [resolve(urlMap, r.images[0])].filter((x): x is string => !!x) : [],
      createdAt: r.created_at,
      box: r.boxes,
    }));

    return { product, relatedProducts };
  });
