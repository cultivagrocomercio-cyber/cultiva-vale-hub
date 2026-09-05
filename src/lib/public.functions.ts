import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { planWeight, type BoxPlan } from "./commission";

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
  plan: BoxPlan;
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
  rating: number | null;
  reviewCount: number;
  box: { id: string; name: string; slug: string; city: string; state: string; region: string; plan: BoxPlan };
}

export interface PublicReview {
  id: string;
  rating: number;
  productRating: number;
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

type RatedBox = { plan: BoxPlan; rating_avg: number | string | null; rating_count: number };

/** Reputação consolidada: média >= 4.5 com pelo menos 5 avaliações concede +1 de peso na relevância. */
export function reputationBoost(b: { rating_avg: number | string | null; rating_count: number }) {
  return b.rating_avg != null && Number(b.rating_avg) >= 4.5 && b.rating_count >= 5 ? 1 : 0;
}
const num = (v: number | string | null) => (v == null ? null : Number(v));

/** Ordena por relevância: peso do plano (premium 3 > intermediário 2 > básico 1) + bônus de reputação, preservando a ordem original dentro do mesmo peso. */
function sortByPlan<T>(rows: T[], plan: (r: T) => RatedBox, rotate = 0): T[] {
  const groups = new Map<number, T[]>();
  for (const r of rows) {
    const b = plan(r);
    const w = planWeight(b.plan) + reputationBoost(b);
    groups.set(w, [...(groups.get(w) ?? []), r]);
  }
  const out: T[] = [];
  for (const w of [4, 3, 2, 1]) {
    const g = groups.get(w) ?? [];
    const k = g.length ? rotate % g.length : 0;
    out.push(...g.slice(k), ...g.slice(0, k));
  }
  return out;
}

/** Home: boxes em destaque + produtos recentes por categoria. */
export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const { createPublicClient, signPaths, resolve } = await import("./supabase-public.server");
  const sb = createPublicClient();

  const [boxesRes, productsRes] = await Promise.all([
    sb.from("boxes").select("*").in("plan", ["intermediario", "premium"]).order("created_at", { ascending: false }).limit(24),
    sb
      .from("products")
      .select("*, boxes!inner(id, name, slug, city, state, region, plan, rating_avg, rating_count)")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  // Premium primeiro, depois intermediário; rotaciona a cada hora para revezar a vitrine
  const rot = Math.floor(Date.now() / 3_600_000);
  const boxes = sortByPlan(boxesRes.data ?? [], (b) => b, rot).slice(0, 8);
  const products = sortByPlan(productsRes.data ?? [], (p) => p.boxes);

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
      plan: b.plan,
      createdAt: b.created_at,
      rating: num(b.rating_avg),
      reviewCount: b.rating_count,
      productCount: counts.get(b.id) ?? 0,
    };
  });

  const recentProducts: PublicProduct[] = products.map((p) => mapProduct(p, urlMap, resolve));

  return { featuredBoxes, recentProducts };
});

function mapProduct(
  p: {
    id: string; name: string; description: string; price: number | string; stock: number;
    category: "plantas" | "insumos" | "maquinas"; subcategory: string; images: string[]; created_at: string;
    rating_avg: number | string | null; rating_count: number;
    boxes: PublicProduct["box"] & { rating_avg?: number | string | null; rating_count?: number };
  },
  urlMap: Record<string, string>,
  resolve: (m: Record<string, string>, k: string | null | undefined) => string | null,
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
    rating: num(p.rating_avg),
    reviewCount: p.rating_count,
    box: { id: p.boxes.id, name: p.boxes.name, slug: p.boxes.slug, city: p.boxes.city, state: p.boxes.state, region: p.boxes.region, plan: p.boxes.plan },
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
        .select("*, boxes!inner(id, name, slug, city, state, region, plan, rating_avg, rating_count)")
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

    const [mainRes, nearRes, boxRes] = await Promise.all([
      buildProducts(data.regiao ? [data.regiao] : null, limit),
      nearbyRegions.length ? buildProducts(nearbyRegions, 12) : Promise.resolve({ data: [], error: null }),
      boxQuery,
    ]);
    if (mainRes.error) throw new Error(mainRes.error.message);
    if (nearRes.error) throw new Error(nearRes.error.message);
    if (boxRes.error) throw new Error(boxRes.error.message);

    // Ordenação algorítmica: premium (3) > intermediário (2) > básico (1) + bônus de reputação (+1); dentro do peso, mantém o critério escolhido
    const mainRows = sortByPlan(mainRes.data ?? [], (p) => p.boxes);
    const nearRows = sortByPlan(nearRes.data ?? [], (p) => p.boxes);
    let boxRows = sortByPlan(boxRes.data ?? [], (b) => b);

    // Contagem de produtos ativos por box (respeitando categoria/sub quando informados)
    let countQuery = sb.from("products").select("box_id, category, subcategory").eq("active", true);
    if (boxRows.length) countQuery = countQuery.in("box_id", boxRows.map((b) => b.id));
    if (data.categoria) countQuery = countQuery.eq("category", data.categoria);
    if (data.sub) countQuery = countQuery.eq("subcategory", data.sub);
    const { data: countRows } = await countQuery;
    const counts = new Map<string, number>();
    for (const r of countRows ?? []) counts.set(r.box_id, (counts.get(r.box_id) ?? 0) + 1);
    if (data.categoria || data.sub) boxRows = boxRows.filter((b) => (counts.get(b.id) ?? 0) > 0);

    const urlMap = await signPaths(sb, [
      ...mainRows.map((p) => p.images[0]),
      ...nearRows.map((p) => p.images[0]),
      ...boxRows.map((b) => b.logo_url),
      ...boxRows.map((b) => b.cover_url),
    ]);

    const boxes: PublicBox[] = boxRows.map((b) => {
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
        plan: b.plan,
        createdAt: b.created_at,
        rating: num(b.rating_avg),
        reviewCount: b.rating_count,
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
      plan: b.plan,
      createdAt: b.created_at,
      rating: num(b.rating_avg),
      reviewCount: b.rating_count,
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
      rating: num(p.rating_avg),
      reviewCount: p.rating_count,
      box: { id: b.id, name: b.name, slug: b.slug, city: b.city, state: b.state, region: b.region, plan: b.plan },
    }));

    const reviews: PublicReview[] = reviewsRaw.map((r) => ({
      id: r.id,
      rating: r.rating,
      productRating: r.product_rating,
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
      .select("*, boxes!inner(id, name, slug, city, state, region, plan, rating_avg, rating_count, logo_url, whatsapp)")
      .eq("id", data.id)
      .eq("active", true)
      .maybeSingle();
    if (!p) return null;

    const [{ data: related }] = await Promise.all([
      sb
        .from("products")
        .select("*, boxes!inner(id, name, slug, city, state, region, plan, rating_avg, rating_count)")
        .eq("box_id", p.box_id)
        .eq("active", true)
        .neq("id", p.id)
        .limit(4),
    ]);

    const urlMap = await signPaths(sb, [...p.images, p.boxes.logo_url, ...(related ?? []).map((r) => r.images[0])]);

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
      rating: num(p.rating_avg),
      reviewCount: p.rating_count,
      box: { id: p.boxes.id, name: p.boxes.name, slug: p.boxes.slug, city: p.boxes.city, state: p.boxes.state, region: p.boxes.region, plan: p.boxes.plan },
      boxLogoUrl: resolve(urlMap, p.boxes.logo_url),
      boxWhatsapp: p.boxes.whatsapp,
      boxRating: num(p.boxes.rating_avg),
      boxReviewCount: p.boxes.rating_count,
    };

    const relatedProducts: PublicProduct[] = (related ?? []).map((r) => mapProduct(r, urlMap, resolve));

    return { product, relatedProducts };
  });

/** Produtos e boxes por id (usado na lista de favoritos). */
export const getPublicByIds = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ productIds: z.array(z.string().uuid()).max(100), boxIds: z.array(z.string().uuid()).max(100) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { createPublicClient, signPaths, resolve } = await import("./supabase-public.server");
    const sb = createPublicClient();

    const [prodRes, boxRes, countRes] = await Promise.all([
      data.productIds.length
        ? sb.from("products").select("*, boxes!inner(id, name, slug, city, state, region, plan, rating_avg, rating_count)").in("id", data.productIds).eq("active", true)
        : Promise.resolve({ data: [] as never[] }),
      data.boxIds.length ? sb.from("boxes").select("*").in("id", data.boxIds) : Promise.resolve({ data: [] as never[] }),
      data.boxIds.length ? sb.from("products").select("box_id").in("box_id", data.boxIds).eq("active", true) : Promise.resolve({ data: [] as never[] }),
    ]);

    const prodRows = (prodRes.data ?? []) as Parameters<typeof mapProduct>[0][];
    type BoxRow = { id: string; name: string; slug: string; logo_url: string | null; cover_url: string | null; description: string; story: string; city: string; state: string; region: string; whatsapp: string | null; plan: BoxPlan; created_at: string; rating_avg: number | string | null; rating_count: number };
    const boxRows = (boxRes.data ?? []) as BoxRow[];
    const counts = new Map<string, number>();
    for (const r of (countRes.data ?? []) as { box_id: string }[]) counts.set(r.box_id, (counts.get(r.box_id) ?? 0) + 1);

    const urlMap = await signPaths(sb, [
      ...prodRows.map((p) => p.images[0]),
      ...boxRows.map((b) => b.logo_url),
      ...boxRows.map((b) => b.cover_url),
    ]);

    const boxes: PublicBox[] = boxRows.map((b) => {
      return {
        id: b.id, name: b.name, slug: b.slug,
        logoUrl: resolve(urlMap, b.logo_url), coverUrl: resolve(urlMap, b.cover_url),
        description: b.description, story: b.story, city: b.city, state: b.state, region: b.region,
        whatsapp: b.whatsapp, plan: b.plan, createdAt: b.created_at,
        rating: num(b.rating_avg), reviewCount: b.rating_count, productCount: counts.get(b.id) ?? 0,
      };
    });

    return { products: prodRows.map((p) => mapProduct(p, urlMap, resolve)), boxes };
  });
