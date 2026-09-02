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

/** Busca de produtos com filtros. */
export const searchProducts = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => searchSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { createPublicClient, signPaths, resolve } = await import("./supabase-public.server");
    const sb = createPublicClient();

    let query = sb
      .from("products")
      .select("*, boxes!inner(id, name, slug, city, state, region)")
      .eq("active", true)
      .limit(data.limit ?? 48);

    if (data.q) query = query.ilike("name", `%${data.q}%`);
    if (data.categoria) query = query.eq("category", data.categoria);
    if (data.sub) query = query.eq("subcategory", data.sub);
    if (data.regiao) query = query.eq("boxes.region", data.regiao);

    if (data.ordem === "menor") query = query.order("price", { ascending: true });
    else if (data.ordem === "maior") query = query.order("price", { ascending: false });
    else query = query.order("created_at", { ascending: false });

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const urlMap = await signPaths(sb, (rows ?? []).map((p) => p.images[0]));

    const products: PublicProduct[] = (rows ?? []).map((p) => ({
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

    return { products };
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
