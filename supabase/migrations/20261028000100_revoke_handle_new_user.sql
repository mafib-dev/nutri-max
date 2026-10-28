-- handle_new_user só roda pelo trigger; ninguém precisa chamá-la pela API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
