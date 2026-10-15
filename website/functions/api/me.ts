import { currentUser, publicUser } from "../_lib/auth";
import { json } from "../_lib/http";

export const onRequestGet = async (context: any): Promise<Response> => {
  const user = await currentUser(context);
  return json({ user: publicUser(user) });
};
