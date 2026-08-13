import { z } from "zod";

export const postSchema = z.object({
  userId: z.number().int().positive(),
  id: z.number().int().positive(),
  title: z.string(),
  body: z.string()
});

export const postDraftSchema = postSchema.omit({ id: true });

export const postPatchSchema = postSchema
  .pick({ title: true, body: true })
  .partial();

export const commentSchema = z.object({
  postId: z.number().int().positive(),
  id: z.number().int().positive(),
  name: z.string(),
  email: z.email(),
  body: z.string()
});

export const userSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  username: z.string(),
  email: z.email(),
  address: z.object({
    street: z.string(),
    suite: z.string(),
    city: z.string(),
    zipcode: z.string(),
    geo: z.object({
      lat: z.string(),
      lng: z.string()
    })
  }),
  phone: z.string(),
  website: z.string(),
  company: z.object({
    name: z.string(),
    catchPhrase: z.string(),
    bs: z.string()
  })
});
