import { Injectable } from '@nestjs/common';
import { DiscoveredCompany } from './discovery.provider';

export interface QualifiedProspect extends DiscoveredCompany {
  problems: string[];
  recommended: string[];
  probability: number;
  level: 'alta' | 'media' | 'baja';
  reasoning: string[];
}

const SIGNAL_PROBLEM: Record<string, string> = {
  noWebsite: 'No posee página web',
  noEmail: 'Sin correo público de contacto',
  weakDigital: 'Presencia digital débil',
  noInstagram: 'Sin Instagram activo',
};

@Injectable()
export class QualificationService {
  private signals(c: DiscoveredCompany): Record<string, boolean> {
    return { noWebsite: !c.website, noEmail: !c.email, noInstagram: !c.instagram, weakDigital: !c.facebook && !c.instagram };
  }

  private recommend(signals: Record<string, boolean>, service: string): string[] {
    const set = new Set<string>();
    if (signals.noWebsite) set.add('Desarrollo Web');
    if (signals.weakDigital) set.add('Automatización con IA');
    set.add(service);
    return Array.from(set).slice(0, 4);
  }

  /** Camino heurístico (respaldo si Gemini no está disponible). */
  qualify(c: DiscoveredCompany, service: string): QualifiedProspect {
    const sig = this.signals(c);
    const active = Object.keys(sig).filter((k) => sig[k]);
    const probability = Math.min(93, 34 + active.length * 12);
    const level = probability >= 70 ? 'alta' : probability >= 50 ? 'media' : 'baja';
    const problems = active.map((k) => SIGNAL_PROBLEM[k]);
    const recommended = this.recommend(sig, service);
    return {
      ...c, problems, recommended, probability, level,
      reasoning: [...problems.map((p) => p + '.'), `Probablemente necesita ${recommended[0] ?? 'una solución Shelby'}.`],
    };
  }
}
