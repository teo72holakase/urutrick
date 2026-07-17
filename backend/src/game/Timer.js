export class TurnTimer {
  constructor(segundos, onExpire) {
    this.segundos = segundos;
    this.onExpire = onExpire;
    this.handle = null;
  }

  iniciar() {
    this.cancelar();
    this.handle = setTimeout(() => this.onExpire(), this.segundos * 1000);
  }

  cancelar() {
    if (this.handle) clearTimeout(this.handle);
    this.handle = null;
  }
}

export const TIEMPOS = {
  jugarCarta: 20,   // seg para tirar carta
  responderCanto: 12, // seg para decir quiero/no quiero
};
