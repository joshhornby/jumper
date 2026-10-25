// Bun imports a file `with { type: "text" }` as its contents.
declare module "*.jumper" {
  const text: string;
  export default text;
}
