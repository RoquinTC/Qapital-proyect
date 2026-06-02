import esMessages from "../../../messages/es.json";

export async function getLocale() {
  return "es";
}

export async function getMessages() {
  return esMessages;
}

export const getRequestConfig = (cb: any) => {
  return async (context: any) => {
    return {
      locale: "es",
      messages: esMessages
    };
  };
};
