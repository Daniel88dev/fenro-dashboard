/** Immutable, identity-less domain concept compared by its values. */
export abstract class ValueObject<Props extends object> {
  protected constructor(protected readonly props: Props) {
    Object.freeze(this.props);
  }

  equals(other?: ValueObject<Props>): boolean {
    if (other === undefined || other === null) return false;
    if (other.constructor !== this.constructor) return false;
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}
