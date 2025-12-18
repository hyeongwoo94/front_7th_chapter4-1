import { useRouterParams } from "../../../../router";
import { useEffect } from "react";
import { loadProductDetailForPage } from "../../productUseCase";

export const useLoadProductDetail = () => {
  const productId = useRouterParams((params) => params.id);

  useEffect(() => {
    if (!productId) {
      return;
    }

    const initialData = typeof window !== "undefined" ? window.__INITIAL_DATA__ : null;
    const hasInitialCurrentProduct = initialData?.productStore?.currentProduct?.productId === productId;

    if (!hasInitialCurrentProduct) {
      loadProductDetailForPage(productId);
    }
  }, [productId]);
};
